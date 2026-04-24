import { Request } from "express";

declare global {
    namespace Express {
        interface Request {
            user?: {
                id: string;
                username: string;
                email: string;
                admin: number;
                full_access: number;
            };
        }
    }
}

export {};