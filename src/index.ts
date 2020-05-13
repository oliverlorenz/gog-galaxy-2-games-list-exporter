import * as dotenv from 'dotenv';
import { GogExporter } from './GogExporter';
import { UniqueGameData } from './Database';
dotenv.config();
// @ts-ignore
import { GoogleSpreadsheet } from 'google-spreadsheet';


(async() => {
    
    ensureConfigurationIsCorrect();

    process.stdout.write('exporting ... ')
    const uniqueGameData = await GogExporter.export(process.env.DATABASE_PATH as string);
    const headerValues = [ 'name', 'platform', 'playtime', 'id' ];
    const speadsheetData = transformData(uniqueGameData);
    process.stdout.write('done\n')

    process.stdout.write(`send to https://docs.google.com/spreadsheets/d/${process.env.SPREADSHEET_ID} ... `)
    const doc = new GoogleSpreadsheet(process.env.SPREADSHEET_ID);
    await doc.useServiceAccountAuth({
        client_email: process.env.SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.SERVICE_ACCOUNT_PRIVATE_KEY

    });
    await doc.loadInfo();
    
    const sheet = await getSheet(doc, process.env.NICKNAME as string);
    await sheet.clear();
    await sheet.setHeaderRow(headerValues);
    await sheet.addRows(speadsheetData);
    process.stdout.write('done\n');
})()

function ensureConfigurationIsCorrect() {
    [
        'DATABASE_PATH',
        'NICKNAME',
        'SPREADSHEET_ID',
        'SERVICE_ACCOUNT_PRIVATE_KEY',
        'SERVICE_ACCOUNT_EMAIL'
    ].forEach((variable) => {
        if (!process.env[variable]) {
            console.error(`please ensure ${variable} is set in "${process.cwd()}/.env" but is mandantory!`)
            process.exit(1);
        }
    });
}

async function getSheet(doc: any, nickname: string) {
    let sheet;
    let sheetId = Object.keys(doc.sheetsById).find((index) => {
        return doc.sheetsById[index].title === process.env.NICKNAME
    });
    if (sheetId) sheet = doc.sheetsById[sheetId];
    

    if (!sheet) {
        sheet = await doc.addSheet({
            title: process.env.NICKNAME
        })
    }
    return sheet;
}

function transformData(uniqueGameDataList: UniqueGameData[]) {
    const speadsheetData: string[][] = [];
    uniqueGameDataList.forEach((uniqueGameData) => {
        uniqueGameData.idList.forEach((id) => {
            const [ platform, idOnly ] = id.split('_');
            const link = getLink(platform, idOnly, uniqueGameData.title);
            speadsheetData.push([
                // @ts-ignore 
                link ? `=HYPERLINK("${link}"; "${uniqueGameData.title}")` : uniqueGameData.title,
                platform,
                (uniqueGameData.playtime / 60).toFixed(0),
                id
            ])
        })
    })
    return speadsheetData;
}

function getLink(platform: string, id: string, title: string): string | null {
    switch (platform) {
        case 'steam':
            return `https://store.steampowered.com/app/${id}`
        case 'uplay': 
            return `https://store.ubi.com/de/search?q=${title}`
        case 'epic':
            return `https://www.epicgames.com/store/de/browse?pageSize=30&q=${title}&sortBy=relevance&sortDir=DESC`
        case 'humble':
            return `https://www.humblebundle.com/store/search?sort=bestselling&search=${title}`
        case 'gog':
            return `https://www.gog.com/games?search=${title}`
        case 'origin':
            return `https://www.origin.com/deu/de-de/search?searchString=${title}`
        default:
            return null
    }
}