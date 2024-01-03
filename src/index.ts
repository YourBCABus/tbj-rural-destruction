import envSetup, { eurekaClientId, eurekaClientSecret, eurekaUrl, initialSheetId, utcClearTime } from "./env";
import DestructionState from "./state";

const resolveAt = async (targetSecsAfterUTCMidnight: number) => {
    while (true) {
        const workingDate = new Date();
        workingDate.setUTCFullYear(1970);
        workingDate.setUTCMonth(0, 1);
        const secondsSinceUTCMidnight = workingDate.getTime() / 1000;

        const SECONDS_PER_DAY = 24 * 60 * 60;
        const in3Min = (secondsSinceUTCMidnight + 180) % SECONDS_PER_DAY;

        if (in3Min < targetSecsAfterUTCMidnight) {
            // Wait 1 minute
            await new Promise(res => setTimeout(res, 60 * 1000));
        } else if (secondsSinceUTCMidnight > targetSecsAfterUTCMidnight) {
            const secondsToWait = Math.min(60, SECONDS_PER_DAY - secondsSinceUTCMidnight);
            await new Promise(res => setTimeout(res, secondsToWait * 1000));
        } else {
            break;
        }
    }
    while (true) {
        const workingDate = new Date();
        workingDate.setUTCFullYear(1970);
        workingDate.setUTCMonth(0, 1);
        const secondsSinceUTCMidnight = workingDate.getTime() / 1000;
        if (secondsSinceUTCMidnight < targetSecsAfterUTCMidnight) {
            await new Promise(res => setTimeout(res, 2000));
        } else break;
    }
}


const main = async () => {
    envSetup();

    const state = await DestructionState.create(
        initialSheetId(),
        eurekaClientId(),
        eurekaClientSecret(),
        eurekaUrl(),
    );


    // Every 5 seconds, sync the state

    while (true) {
        // await resolveAt(utcClearTime());
        console.log(`Running at: ${new Date().toLocaleString()}`);

        try {
            await state.runVersionHistoryClear();
        } catch (e) {
            if (e instanceof Error) {
                console.error(e.name);
                console.error(e.message);
                console.error(e.stack);
                console.error(e);
            } else {
                console.error("Unknown error type:", e);
            }
        }

        process.exit(0);
    }
};


main();


