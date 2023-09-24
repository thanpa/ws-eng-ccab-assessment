import express from "express";
import { createClient, WatchError} from "redis";
import { json } from "body-parser";
const DEFAULT_BALANCE = 100;

interface ChargeResult {
    isAuthorized: boolean;
    remainingBalance: number;
    charges: number;
    error: any;
}

async function connect(): Promise<ReturnType<typeof createClient>> {
    const url = `redis://${process.env.REDIS_HOST ?? "localhost"}:${process.env.REDIS_PORT ?? "6379"}`;
    console.log(`Using redis URL ${url}`);
    const client = createClient({ url });
    await client.connect();
    return client;
}

async function reset(account: string): Promise<void> {
    const client = await connect();
    try {
        await client.set(`${account}/balance`, DEFAULT_BALANCE);
    } finally {
        await client.disconnect();
    }
}

async function charge(account: string, charges: number): Promise<ChargeResult> {
    const client = await connect();
    const balanceKey = `${account}/balance`
    try {
        await client.watch(balanceKey);
        const balance = parseInt((await client.get(balanceKey)) ?? "");
        if (balance >= charges) {
            const remainingBalance = balance - charges;
            const multi = client.multi();
            multi.set(balanceKey, remainingBalance);
            await multi.exec();
            return { isAuthorized: true, remainingBalance, charges, error: null };
        } else {
            return { isAuthorized: false, remainingBalance: balance, charges: 0, error: null };
        }
    } catch (error) {
        const balance = parseInt((await client.get(balanceKey)) ?? "");
        return { isAuthorized: false, remainingBalance: balance, charges: 0, error: "The balance was changed between calls, please retry" };
    } finally {
        await client.disconnect();
    }
}

export function buildApp(): express.Application {
    const app = express();
    app.use(json());
    app.post("/reset", async (req, res) => {
        try {
            const account = req.body.account ?? "account";
            await reset(account);
            console.log(`Successfully reset account ${account}`);
            res.sendStatus(204);
        } catch (e) {
            console.error("Error while resetting account", e);
            res.status(500).json({ error: String(e) });
        }
    });
    app.post("/charge", async (req, res) => {
        try {
            const account = req.body.account ?? "account";
            const result = await charge(account, req.body.charges ?? 10);
            console.log(`Successfully charged account ${account}`);
            res.status(200).json(result);
        } catch (e) {
            console.error("Error while charging account", e);
            res.status(500).json({ error: String(e) });
        }
    });
    return app;
}
