export type GraphQLQuery<Input, Output> = (variables: Input) => Output;
export type Variables<Query extends GraphQLQuery<any, any>> = Parameters<Query>[0];
export type Result<Query extends GraphQLQuery<any, any>> = ReturnType<Query>;


import { inspect } from "util";

export default class EurekaContext {
    #clientId: string;
    #clientSecret: string;

    #eurekaUrl: string;

    constructor(clientId: string, clientSecret: string, eurekaUrl: string) {
        this.#clientId = clientId;
        this.#clientSecret = clientSecret;

        this.#eurekaUrl = eurekaUrl;
    }

    public async execQuery<Query extends GraphQLQuery<any, any>>(
        text: string,
        queryName: string,
        variables: Variables<Query>,
    ): Promise<Result<Query>> {
        const body = {
            query: text,
            operationName: queryName,
            variables,
        };

        const response = await fetch(this.#eurekaUrl, {
            method: 'POST',
            body: JSON.stringify(body),
            headers: {
                'Content-Type': 'application/json',
                'Client-Id': this.#clientId,
                'Client-Secret': this.#clientSecret,
            },
        });

        if (!response.ok) {
            throw new Error(`Failed to execute query: ${response.statusText}`);
        }

        const json = await response.json();

        if (json.errors) {
            throw new Error(`Failed to execute query: ${inspect(json.errors)}`);
        }

        return json.data;
    }

    private static readonly QUERIES = `
    mutation SetSpreadsheetId($newId: String!) {
        setSpreadsheetId(id: $newId)
    }
    query GetSpreadsheetId {
        id: currSpreadsheetId
    }
    mutation ClearTemps {
        syncAndFlushFutures
        clearAllTempTimes
        clearAllTempPeriods
    }
    `;

    public async setSpreadsheetid(id: string) {
        type SetSpreadsheetId = GraphQLQuery<{ newId: string }, {}>;

        await this.execQuery<SetSpreadsheetId>(EurekaContext.QUERIES, 'SetSpreadsheetId', { newId: id });
    }
    public async getSpreadsheetId(): Promise<string> {
        type GetSpreadsheetId = GraphQLQuery<{}, { id: string }>;

        const response = await this.execQuery<GetSpreadsheetId>(EurekaContext.QUERIES, 'GetSpreadsheetId', {});
        return response.id;
    }


    public async clearTemps() {
        type ClearTemps = GraphQLQuery<{}, {}>;

        await this.execQuery<ClearTemps>(EurekaContext.QUERIES, 'ClearTemps', { });
    }
}

