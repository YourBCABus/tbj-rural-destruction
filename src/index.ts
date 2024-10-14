import envSetup, { eurekaClientId, eurekaClientSecret, eurekaUrl, utcClearTime, webhookUrl } from "./env";
import DestructionState from "./state";

const isOneShot = process.argv.includes("--ONESHOT");

const resolveAt = async (targetTime: number) => {
    while (true) {
        const workingDate = new Date();
        workingDate.setUTCFullYear(1970);
        workingDate.setUTCMonth(0, 1);
        const currTime = workingDate.getTime() / 1000;

        const SECONDS_PER_DAY = 24 * 60 * 60;
        const timeIn3Min = (currTime + 180) % SECONDS_PER_DAY;

        if (timeIn3Min < targetTime) { // If the target time is more than 3 minutes away...
            // Wait 1 minute
            await new Promise(res => setTimeout(res, 60 * 1000));
        } else if (currTime > targetTime) { // If the target time has already passed...
            // Wait until the next day (in 1 minute increments)
            const secondsToWait = Math.min(60, SECONDS_PER_DAY - currTime);
            await new Promise(res => setTimeout(res, secondsToWait * 1000));
        } else { // Otherwise, the target time is within 3 minutes (active window)
            // Head to the next section of the wait
            break;
        }
    }

    // Target time is less than 3 minutes away, but is still in the future
    while (true) {
        const workingDate = new Date();
        workingDate.setUTCFullYear(1970);
        workingDate.setUTCMonth(0, 1);
        const currTime = workingDate.getTime() / 1000;

        if (currTime < targetTime) { // If the target time has not yet passed...
            // Wait 2 seconds
            await new Promise(res => setTimeout(res, 2000));
        } else break; // Resolve the promise
    }
};


const main = async () => {
    envSetup();

    const state = await DestructionState.create(
        eurekaClientId(),
        eurekaClientSecret(),
        eurekaUrl(),
        webhookUrl(),
    );


    // Every 5 seconds, sync the state

    while (true) {
        if (!isOneShot) await resolveAt(utcClearTime());
        console.log(`Running at: ${new Date().toLocaleString()}`);

        try {
            await state.runVersionHistoryClear();
        } catch (e) {
            if (e instanceof Error) {
                console.error(e.name);
                console.error(e.message);
                console.error(e.stack);
                console.error(e);

                await state.sendWebhookError(
                    "An error occurred while running the version history clear",
                    e.message,
                    e.stack ?? "<No stack trace available>",
                );
            } else {
                console.error("Unknown error type:", e);

                await state.sendWebhookError(
                    "An error occurred while running the version history clear",
                    "Unknown error type :(",
                    e ? e.toString() : "<No error message available>",
                );
            }
        }

        console.log("Done running at:", new Date().toLocaleString());

        console.log("\n\n");
        if (isOneShot) return;
    }
};

main();
