import EurekaContext from "./eureka";
import setup, { clearSpreadsheet, copyPerms, copySpreadsheet, deleteSheet } from "./google";

export default class DestructionState {
    #currSheetId: string;
    #eurekaContext: EurekaContext;

    #webhookUrl: string;

    private constructor(currSheetId: string, eurekaContext: EurekaContext, webhookUrl: string) {
        this.#currSheetId = currSheetId;
        this.#eurekaContext = eurekaContext;
        this.#webhookUrl = webhookUrl;
    }

    public static async create(
        clientId: string,
        clientSecret: string,
        eurekaUrl: string,
        webhookUrl?: string,
    ): Promise<DestructionState> {
        await setup();

        const eurekaContext = new EurekaContext(clientId, clientSecret, eurekaUrl);

        const sheetId = await eurekaContext.getSpreadsheetId();
        return new DestructionState(sheetId, eurekaContext, webhookUrl || "");
    }

    public async runVersionHistoryClear() {
        await clearSpreadsheet(this.#currSheetId);
        console.log("Cleared spreadsheet");
        
        const newSpreadsheetId = await copySpreadsheet(this.#currSheetId);
        console.log("Created copy of spreadsheet");
        
        await this.#eurekaContext.setSpreadsheetid(newSpreadsheetId);
        console.log("Updated spreadsheetId stored on the DB");

        await copyPerms(this.#currSheetId, newSpreadsheetId);
        console.log("Populated perms from original to clone")

        await deleteSheet(this.#currSheetId);
        console.log("Permanantly deleted original spreadsheet");

        this.#currSheetId = await this.#eurekaContext.getSpreadsheetId();
        console.log("Updated internal spreadsheet ID");

        await this.#eurekaContext.clearTemps();
        console.log("Cleared temporary period times for today");
    }

    public async sendWebhookError(title: string, description: string, error: string) {
        if (!this.#webhookUrl) {
            console.error("Webhook URL not set, skipping sending error");
            return;
        }

        const sanitizedTitle = title.replace(/\`\#\@\*\-/g, s => `\\${s}`);
        const sanitizedDescription = description.replace(/\`\#\@\*\-/g, s => `\\${s}`);
        const sanitizedError = error.replace(/`{3}/g, s => `'''`);

        const content = `# ${sanitizedTitle}\n<@&1302455829160788060>\n${sanitizedDescription}\n\`\`\`${sanitizedError}\`\`\``;

        const body = {
            content,
            embeds: null,
            attachments: [],
        };
        const res = await fetch(this.#webhookUrl, {
            method: "POST",
            body: JSON.stringify(body),
            headers: {
                "Content-Type": "application/json",
            },
        });

        if (!res.ok) {
            console.error("Failed to send webhook error:", await res.text());
        }
    }
}
