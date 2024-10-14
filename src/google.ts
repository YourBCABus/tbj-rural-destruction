// Modified from https://github.com/googleworkspace/node-samples/blob/main/sheets/quickstart/index.js

import { readFile, writeFile } from 'fs/promises';
import { join as joinPath } from 'path';
import { cwd as currDir } from 'process';

import { authenticate } from '@google-cloud/local-auth';
import { google, sheets_v4, drive_v3 } from 'googleapis';

import { OAuth2Client } from 'google-auth-library';
import { inspect } from 'util';
import {
    CLEARABLE_DATA_RANGE,
    REPORT_TO_CELL,
    parseCell,
    parseDataRange,
} from './consts';

// If modifying these scopes, delete token.json.
const SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive',
];

// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = joinPath(currDir(), 'token.json');
const CREDENTIALS_PATH = joinPath(currDir(), 'credentials.json');




const authorize = async (): Promise<OAuth2Client> => {
    let client = await loadSavedCreds();
    if (client) {
        return client;
    }
    client = await authenticate({
        scopes: SCOPES,
        keyfilePath: CREDENTIALS_PATH,
    });
    if (client.credentials) {
        await saveCreds(client);
    }
    return client;
};

const loadSavedCreds = async (): Promise<OAuth2Client | null> => {
    try {
        const content = await readFile(TOKEN_PATH, 'utf-8');
        const credentials = JSON.parse(content);
        return google.auth.fromJSON(credentials) as OAuth2Client;
    } catch (err) {
        return null;
    }
};

const saveCreds = async (client: OAuth2Client) => {
    const content = await readFile(CREDENTIALS_PATH, 'utf-8');
    const keys = JSON.parse(content);
    const key = keys.installed || keys.web;
    const payload = JSON.stringify({
        type: 'authorized_user',
        client_id: key.client_id,
        client_secret: key.client_secret,
        refresh_token: client.credentials.refresh_token,
    });
    await writeFile(TOKEN_PATH, payload);
};

let oauthClient: OAuth2Client | null;
let driveApi: drive_v3.Drive | null;
let sheetsApi: sheets_v4.Sheets | null;

export const getOauthClient = async () => oauthClient ?? (oauthClient = await authorize());
export const getDriveApi = async () => driveApi ?? (driveApi = google.drive({ version: 'v3', auth: await getOauthClient() }));
export const getSheetsApi = async () => sheetsApi ?? (sheetsApi = google.sheets({ version: 'v4', auth: await getOauthClient() }));


export const clearSpreadsheet = async (spreadsheetId: string) => {
    const sheetsApi = await getSheetsApi();

    const sheetData = await sheetsApi.spreadsheets.get({ spreadsheetId });
    const gridProperties = sheetData.data.sheets?.find(sheet => sheet.properties?.gridProperties)?.properties?.gridProperties;
    if (!gridProperties) throw new Error("The spreadsheet has no child sheets");

    const { rowCount, columnCount } = gridProperties;
    if (!rowCount || !columnCount) throw new Error("The sheet has no cells");

    const { startCol, startRow, endCol, endRow } = parseDataRange(CLEARABLE_DATA_RANGE);

    const rows = endRow - startRow + 1;
    const columns = endCol - startCol + 1;

    const overwritingData: sheets_v4.Schema$RowData[] = Array(rows)
        .fill(null)
        .map(() => ({
            values: Array(columns)
                .fill(null)
                .map(() => ({ userEnteredValue: { stringValue: "" } }))
        }));

    const clearCellsResponse = await sheetsApi.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: [{ updateCells: {
            start: {
                sheetId: 0,
                columnIndex: startCol,
                rowIndex: startRow,
            },
            rows: overwritingData,
            fields: "userEnteredValue"
        }}]}
    });
    
    if (clearCellsResponse.status !== 200) {
        throw new Error(`Response failed: ${inspect(clearCellsResponse, true, null, true)}`);
    }


    const resetReportToResponse = await sheetsApi.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: [{ updateCells: {
            start: {
                sheetId: 0,
                columnIndex: parseCell(REPORT_TO_CELL, -1).col,
                rowIndex: parseCell(REPORT_TO_CELL, -1).row,
            },
            rows: [{ values: [{ userEnteredValue: { stringValue: "Upper Caf." } }] }],
            fields: "userEnteredValue"
        }}]}
    });

    if (resetReportToResponse.status !== 200) {
        throw new Error(`Response failed: ${inspect(resetReportToResponse, true, null, true)}`);
    }
};

export const copySpreadsheet = async (spreadsheetId: string): Promise<string> => {
    const driveApi = await getDriveApi();

    const containingFolder = await driveApi.files.get({ fileId: spreadsheetId, fields: "*" });
    if (containingFolder.status !== 200) throw new Error(`Req failed: ${inspect(containingFolder, true, null, true)}`);
    const parentId = containingFolder.data.parents?.[0];
    if (!parentId) throw new Error(`Copied file was not in an folder: ${inspect(containingFolder, true, null, true)}`);

    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const shortDate = tomorrow.toLocaleDateString('en-CA');

    const newName = containingFolder.data.name?.replace(/<.+>/, "").trim().replace(/$/, ` <${shortDate}>`);

    const response = await driveApi.files.copy({
        fileId: spreadsheetId,
        requestBody: {
            parents: [parentId],
            name: newName,
        }
    });
    if (response.status !== 200) throw new Error(`Req failed: ${inspect(response, true, null, true)}`);

    const id = response.data.id;
    if (!id) throw new Error("Copied file does not have an ID");

    return id;
};

export const copyPerms = async (fromId: string, toId: string) => {
    const driveApi = await getDriveApi();

    const permsToCopyResponse = await driveApi.permissions.list({ fileId: fromId, fields: "*" });
    if (permsToCopyResponse.status !== 200) throw new Error(`Req failed: ${inspect(permsToCopyResponse, true, null, true)}`);

    const permsToCopy = permsToCopyResponse.data.permissions;
    if (!permsToCopy) throw new Error(`Failed to get permissions for file ${fromId}`);

    const failures: [drive_v3.Schema$Permission, Error][] = [];

    for (const perm of permsToCopy) {
        try {
            if (perm.role === "owner") continue;
    
            const createPermBody: drive_v3.Schema$Permission = {
                role: perm.role,
                type: perm.type,
                emailAddress: perm.emailAddress,
            };
            const response = await driveApi.permissions.create({
                fileId: toId,
                sendNotificationEmail: false,
                requestBody: createPermBody,
            });
            if (response.status !== 200) throw new Error(`Req failed: ${inspect(response, true, null, true)}`);
        } catch (e) {
            if (e instanceof Error) failures.push([perm, e]);
            else failures.push([perm, new Error(`Req failed: ${inspect(e, true, null, true)}`)]);
        }
    }

    if (failures.length > 0) {
        const errors = failures.map(
            ([perm, error]) => `When trying to add permission ${inspect(perm, true, null, true)}, got error ${error.toString()}`,
        );
        throw new Error("Copy Perms failed due to the following errors:\n" + errors.join("\n"));
    }
};

export const deleteSheet = async (spreadsheetId: string) => {
    const driveApi = await getDriveApi();

    const response = await driveApi.files.delete({ fileId: spreadsheetId });
    if (response.status < 200 || response.status > 299) throw new Error(`Deleting sheet failed: ${inspect(response, true, null, true)}`);
}

const setup = async () => {
    await getOauthClient();
    await getDriveApi();
    await getSheetsApi();
};

export default setup;
