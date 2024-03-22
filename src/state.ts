import EurekaContext from "./eureka";
import setup, { clearSpreadsheet, copyPerms, copySpreadsheet, deleteSheet } from "./google";

export default class DestructionState {
    #currSheetId: string;
    #eurekaContext: EurekaContext;


    private constructor(currSheetId: string, eurekaContext: EurekaContext) {
        this.#currSheetId = currSheetId;
        this.#eurekaContext = eurekaContext;
    }

    public static async create(
        clientId: string,
        clientSecret: string,
        eurekaUrl: string,
    ): Promise<DestructionState> {
        await setup();

        const eurekaContext = new EurekaContext(clientId, clientSecret, eurekaUrl);

        const sheetId = await eurekaContext.getSpreadsheetId();
        return new DestructionState(sheetId, eurekaContext);
    }

    public async runVersionHistoryClear() {
        await clearSpreadsheet(this.#currSheetId);
        console.log("Cleared spreadsheet");
        
        const newSpreadsheetId = await copySpreadsheet(this.#currSheetId);
        console.log("Created copy of spreadsheet");
        
        await copyPerms(this.#currSheetId, newSpreadsheetId);
        console.log("Populated perms from original to clone")

        await this.#eurekaContext.setSpreadsheetid(newSpreadsheetId);
        console.log("Updated spreadsheetId stored on the DB");

        await deleteSheet(this.#currSheetId);
        console.log("Permanantly deleted original spreadsheet");

        this.#currSheetId = await this.#eurekaContext.getSpreadsheetId();
        console.log("Updated internal spreadsheet ID");

        await this.#eurekaContext.clearTemps();
        console.log("Cleared temporary period times for today");
    }
}
