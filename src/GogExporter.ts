import { Database, UniqueGameData } from "./Database";
import * as sqlite3 from 'sqlite3';

export class GogExporter {
    static async export(databasePath: string): Promise<UniqueGameData[]> {
        const db = new sqlite3.Database(databasePath);
        return new Promise((resolve) => {
            db.serialize(async () => {
                const result = await Database.getUniqueGameData(db);
                db.close(() => {
                    resolve(result);
                });
            });
        })
        
    }
}