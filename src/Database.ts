import * as sqlite3 from 'sqlite3';

export interface MasterDBEntry {
    releaseKeyIdList: string, 
    title: string, 
    metadata: string, 
    playtime: number
}

export interface UniqueGameData {
    idList: string[],
    platforms: string[],
    title: string,
    metadata: object,
    playtime: number
}

export class Database {
    static async query(db: sqlite3.Database, sql: string, type: string, params?: any[]): Promise<sqlite3.RunResult> {
        return new Promise((resolve, reject) => {
            if (params) {
                // @ts-ignore
                return db[type](sql, params, (err: Error | null, result: sqlite3.RunResult, ) => {
                    if (err) return reject(err);
                    resolve(result);
                });
            } else {
                // @ts-ignore
                return db[type](sql, (err: Error | null, result: sqlite3.RunResult, ) => {
                    if (err) return reject(err);
                    resolve(result);
                });
            }
        });
    }
    
    static async run(db: sqlite3.Database, sql: string, params?: any[]) {
        return this.query(db, sql, 'run', params);
    }
    
    static async get<T>(db: sqlite3.Database, sql: string) : Promise<T>{
        // @ts-ignore
        return this.query(db, sql, 'get');
    }
    
    static async all<T>(db: sqlite3.Database, sql: string) : Promise<T[]>{
        // @ts-ignore
        return this.query(db, sql, 'all');
    }

    static async createMasterList(db: sqlite3.Database) {
        return Database.run(
            db,
            `
            CREATE TEMP VIEW MasterList AS 
                SELECT 
                    GamePieces.releaseKey, 
                    GamePieces.gamePieceTypeId, 
                    GamePieces.value 
                FROM GameLinks 
                JOIN GamePieces 
                    ON GameLinks.releaseKey = GamePieces.releaseKey`
        )
    }
    
    static async getOriginalTitleId(db: sqlite3.Database): Promise<number> {
        const result = await this.get<{id: number}>(
            db,
            `SELECT id FROM GamePieceTypes WHERE type='title'`
        )
        return result.id;
    }
    
    static async getMetaId(db: sqlite3.Database): Promise<number> {
        const result = await this.get<{id: number}>(
            db,
            `SELECT id FROM GamePieceTypes WHERE type='meta'`
        )
        return result.id;
    }
    
    static async getTitleId(db: sqlite3.Database): Promise<number> {
        const result = await this.get<{id: number}>(
            db,
            `SELECT id FROM GamePieceTypes WHERE type='title'`
        )
        return result.id;
    }
    
    static async getOriginalMetaId(db: sqlite3.Database): Promise<number> {
        const result = await this.get<{id: number}>(
            db,
            `SELECT id FROM GamePieceTypes WHERE type='originalMeta'`
        )
        return result.id;
    }
    
    static async getReleasesList(db: sqlite3.Database): Promise<number> {
        const result = await this.get<{id: number}>(
            db,
            `SELECT id FROM GamePieceTypes WHERE type='allGameReleases'`
        )
        return result.id;
    }
    
    static async getUniqueGameData(db: sqlite3.Database): Promise<UniqueGameData[]> {
        await this.createMasterList(db);
        await this.createMasterDb(db);
        // @ts-ignore
        return (await this.all<MasterDBEntry>(
            db,
            `
            SELECT 
                GROUP_CONCAT(DISTINCT MasterDB.releaseKey) as releaseKeyIdList, 
                MasterDB.title, 
                MasterDB.metadata, 
                SUM(MasterDB.time) as playtime
            FROM 
                MasterDB 
            GROUP BY MasterDB.platformList 
            ORDER BY MasterDB.title;
            `
        )).map((entry: MasterDBEntry) => {
            return {
                platforms: entry.releaseKeyIdList.split(',').map((entry: string) => {
                    return entry.split('_')[0]
                }),
                idList: entry.releaseKeyIdList.split(','),
                title: JSON.parse(entry.title).title,
                metadata: JSON.parse(entry.metadata),
                playtime: entry.playtime,
            }
        });
    }
    
    static async createMasterDb(db: sqlite3.Database) {
        return this.run(
            db,
            `
            CREATE TEMP VIEW MasterDB AS 
                SELECT 
                    DISTINCT(MasterList.releaseKey) AS releaseKey,
                    MasterList.value AS title, 
                    MC1.value AS metadata, 
                    MC2.value AS platformList, 
                    GameTimes.minutesInGame AS time
                FROM 
                    MasterList, 
                    MasterList AS MC1, 
                    MasterList AS MC2, 
                    GameTimes 
                WHERE (
                    (
                        (MasterList.gamePieceTypeId=${await this.getOriginalTitleId(db)}) 
                        OR (MasterList.gamePieceTypeId=${await this.getTitleId(db)})
                    ) AND (
                        (MC1.gamePieceTypeId=${await this.getOriginalMetaId(db)}) 
                        OR (MC1.gamePieceTypeId=${await this.getMetaId(db)})
                    )
                ) 
                AND MC1.releaseKey=MasterList.releaseKey 
                AND MC2.gamePieceTypeId=${await this.getReleasesList(db)} 
                AND MC2.releaseKey=MasterList.releaseKey
                AND GameTimes.releaseKey=MasterList.releaseKey 
                ORDER BY title;`
        );
    }
}