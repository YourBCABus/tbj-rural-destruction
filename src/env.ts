import { configDotenv } from "dotenv";


const envVarAccessor = <T>(acc: () => T | undefined) => () => {
    const val = acc();
    if (val) return val;
    else throw new Error("Make sure to call envSetup");
};

const optEnvVarAccessor = <T>(acc: () => T | undefined) => () => {
    return acc();
}

export const eurekaUrl = envVarAccessor(() => process.env.EUREKA_URL);
export const eurekaClientId = envVarAccessor(() => process.env.EUREKA_CLIENT_ID);
export const eurekaClientSecret = envVarAccessor(() => process.env.EUREKA_CLIENT_SECRET);
export const utcClearTime = envVarAccessor(() => Number(process.env.UTC_CLEAR_TIME));
export const webhookUrl = optEnvVarAccessor(() => process.env.WEBHOOK_URL);

const envSetup = () => {
    configDotenv();

    try {
        eurekaUrl();
        eurekaClientId();
        eurekaClientSecret();
        utcClearTime();
        webhookUrl();
    } catch (e) {
        throw new Error("Missing env variables! (EUREKA_URL, EUREKA_CLIENT_ID, EUREKA_CLIENT_SECRET, UTC_CLEAR_TIME, and/or INITIAL_SHEET_ID)");
    }

    try {
        new URL(eurekaUrl());
    } catch (e) {
        throw new Error(`Invalid Eureka URL: ${(e ?? "").toString()}`)
    }

    try {
        if (Number.isNaN(utcClearTime())) throw new Error(`Invalid UTC clear time: ${utcClearTime()}`);
    } catch (e) {
        throw new Error("Unreachable");
    }
};
export default envSetup;

