const oracledb = require('oracledb');
const Product = require('../models/goldModel');
require('dotenv').config();

class GoldService {
    static syncStatus = {
        isRunning: false,
        lastRun: null,
        lastSuccess: null,
        lastError: null,
        processedItems: 0,
        totalItems: 0,
        successfulInserts: 0,
        failedInserts: 0,
        retryCount: 0
    };

    static async fetchAndSaveGoldData(site = '10103', date = '17-10-24') {
        let connection;
        try {
            // Update sync status
            this.syncStatus.isRunning = true;
            this.syncStatus.lastRun = new Date();
            this.syncStatus.lastError = null;
            this.syncStatus.processedItems = 0;
            this.syncStatus.successfulInserts = 0;
            this.syncStatus.failedInserts = 0;

            // Connect to Oracle
            connection = await oracledb.getConnection({
                user: process.env.DB_USER,
                password: process.env.DB_PASSWORD,
                connectString: process.env.DB_CONNECTION_STRING
            });

            // Define the query with corrected bind variables
            const query = `
                WITH art AS (
                    SELECT DISTINCT
                        acasite,
                        acacode,
                        ACACINV,
                        ACALIBC,
                        ACALIBL,
                        ACAPRIX,
                        arulong * NVL(pkparpostes.get_postvan3(1, 0, 1202, pkparpostes.get_postvan2(1, 0, 806, aruumes)), 1) as arulong,
                        arularg * NVL(pkparpostes.get_postvan3(1, 0, 1202, pkparpostes.get_postvan2(1, 0, 806, aruumes)), 1) as arularg,
                        aruhaut * NVL(pkparpostes.get_postvan3(1, 0, 1202, pkparpostes.get_postvan2(1, 0, 806, aruumes)), 1) as aruhaut,
                        arupbru * NVL(pkparpostes.get_postvan3(1, 0, 1201, pkparpostes.get_postvan2(1, 0, 806, ARUUPDS)), 1) as arupbru,
                        SITLIN1,
                        SITCAP1,
                        SITFAC1,
                        SITLIN2,
                        SITCAP2,
                        SITFAC2,
                        SITLIN3,
                        SITCAP3,
                        SITFAC3,
                        SITLIN4,
                        SITCAP4,
                        SITFAC4,
                        SITLIN5,
                        SITCAP5,
                        SITFAC5,
                        NVL(pkstock.getStockDispoEnPds(1, ACASITE, ARUCINL), 0) as soh
                    FROM ARTCAISSE
                    INNER JOIN artsite ON acasite = sitsite AND acacinv = SITCINV AND SITLIEN = 1
                    INNER JOIN ARTUL ON ARUCINLUVC = ACACINV AND ARUTYPUL = 1
                    WHERE ACAACTI < 2
                    AND acasite = :v_site
                    AND TO_CHAR(acadmaj, 'DD/MM/YY') >= :v_date
                ),
                promo AS (
                    SELECT
                        site,
                        cinv,
                        CASE
                            WHEN promo1a IS NOT NULL THEN promo1a
                            WHEN promo2 IS NOT NULL THEN promo2
                            ELSE promo1b
                        END promocode,
                        DECODE(promo2, NULL, NULL, kdspkmixmatch.get_fixprice(promo2, cinv)) fprice,
                        DECODE(promo1a, NULL, NULL, NVL(kdspkmixmatch.get_listval(promo1a, 'DISC1'), NULL)) disc1,
                        DECODE(promo1a, NULL, NULL, NVL(kdspkmixmatch.get_listval(promo1a, 'DISC2'), NULL)) disc2,
                        DECODE(promo1a, NULL, NULL, NVL(kdspkmixmatch.get_listval(promo1a, 'DISC3'), NULL)) disc3,
                        DECODE(promo1a, NULL, NULL, NVL(kdspkmixmatch.get_listval(promo1a, 'DISCRP'), NULL)) discrp,
                        DECODE(promo1b, NULL, NULL, NVL(kdspkmixmatch.get_listval(promo1b, 'DISCM1'), NULL)) discm1,
                        DECODE(promo1b, NULL, NULL, NVL(kdspkmixmatch.get_listval(promo1b, 'DISCM2'), NULL)) discm2,
                        DECODE(promo1b, NULL, NULL, NVL(kdspkmixmatch.get_listval(promo1b, 'DISCM3'), NULL)) discm3,
                        DECODE(promo1b, NULL, NULL, NVL(kdspkmixmatch.get_listval(promo1b, 'DISCMRP'), NULL)) discmrp,
                        CASE
                            WHEN promo1a IS NOT NULL THEN ermddeb1a
                            WHEN promo2 IS NOT NULL THEN ermddeb2
                            ELSE ermddeb1b
                        END ermddeb,
                        CASE
                            WHEN promo1a IS NOT NULL THEN ermdfin1a
                            WHEN promo2 IS NOT NULL THEN ermdfin2
                            ELSE ermdfin1b
                        END ermdfin
                    FROM
                        kdspromotion,
                        (SELECT ermndis, TO_DATE(CONCAT(TO_CHAR(ermddeb, 'DD/MM/YY'), NVL(ermhdeb, '0000')), 'DD/MM/YYHH24MI') ermddeb1a, TO_DATE(CONCAT(TO_CHAR(ermdfin, 'DD/MM/YY'), NVL(ermhfin, '2359')), 'DD/MM/YYHH24MI') ermdfin1a FROM mixentpos WHERE ermdnum = 1) mix1a,
                        (SELECT ermndis, TO_DATE(CONCAT(TO_CHAR(ermddeb, 'DD/MM/YY'), NVL(ermhdeb, '0000')), 'DD/MM/YYHH24MI') ermddeb1b, TO_DATE(CONCAT(TO_CHAR(ermdfin, 'DD/MM/YY'), NVL(ermhfin, '2359')), 'DD/MM/YYHH24MI') ermdfin1b FROM mixentpos WHERE ermdnum = 1) mix1b,
                        (SELECT ermndis, TO_DATE(CONCAT(TO_CHAR(ermddeb, 'DD/MM/YY'), NVL(ermhdeb, '0000')), 'DD/MM/YYHH24MI') ermddeb2, TO_DATE(CONCAT(TO_CHAR(ermdfin, 'DD/MM/YY'), NVL(ermhfin, '2359')), 'DD/MM/YYHH24MI') ermdfin2 FROM mixentpos WHERE ermdnum = 2) mix2
                    WHERE
                        TRUNC(promodate) = TRUNC(SYSDATE)
                        AND promo1a = mix1a.ermndis(+)
                        AND promo1b = mix1b.ermndis(+)
                        AND promo2 = mix2.ermndis(+)
                        AND site = :v_site
                        AND TO_CHAR(dmaj, 'DD/MM/YY') >= :v_date
                )
                SELECT
                    art.acasite AS Site,
                    PKSITDGENE.get_sitedescription(1, art.acasite) AS SiteName,
                    pkdwh.get_sku(art.acacinv) AS SKU,
                    art.acacode AS Barcode,
                    art.ACALIBC AS Short_Desc,
                    art.ACALIBL AS LongDesc,
                    art.arulong AS Length,
                    art.arularg AS Width,
                    art.aruhaut AS Height,
                    art.arupbru AS Weight,
                    'cm' AS UnitOfMeasure,
                    'g' AS UnitOfWeight,
                    art.SITLIN1 AS Location1,
                    DECODE(art.SITLIN1, NULL, NULL, 
                        NVL(art.SITCAP1, 1) || LPAD(NVL(art.SITFAC1, 1), 2, '0')) AS Shelving1,
                    art.SITLIN2 AS Location2,
                    DECODE(art.SITLIN2, NULL, NULL, 
                        NVL(art.SITCAP2, 1) || LPAD(NVL(art.SITFAC2, 1), 2, '0')) AS Shelving2,
                    art.SITLIN3 AS Location3,
                    DECODE(art.SITLIN3, NULL, NULL, 
                        NVL(art.SITCAP3, 1) || LPAD(NVL(art.SITFAC3, 1), 2, '0')) AS Shelving3,
                    art.SITLIN4 AS Location4,
                    DECODE(art.SITLIN4, NULL, NULL, 
                        NVL(art.SITCAP4, 1) || LPAD(NVL(art.SITFAC4, 1), 2, '0')) AS Shelving4,
                    art.SITLIN5 AS Location5,
                    DECODE(art.SITLIN5, NULL, NULL, 
                        NVL(art.SITCAP5, 1) || LPAD(NVL(art.SITFAC5, 1), 2, '0')) AS Shelving5,
                    art.soh AS SoH,
                    art.ACAPRIX AS Hrg_Normal,
                    NVL(promo.discrp, promo.discmrp) AS HrgPromo,
                    NVL(NVL(promo.disc1, NVL(promo.disc2, promo.disc3)), NVL(promo.discm1, NVL(promo.discm2, promo.discm3))) AS Disc,
                    promo.fprice AS HSP,
                    promo.ermddeb AS StartDate,
                    promo.ermdfin AS EndDate
                FROM art
                LEFT JOIN promo ON art.acasite = promo.site AND art.acacinv = promo.cinv`;

            // Set up bind variables
            const binds = {
                v_site: site,
                v_date: date
            };

            console.log('Executing Oracle query...');
            const result = await connection.execute(query, binds, {
                outFormat: oracledb.OUT_FORMAT_OBJECT,
                fetchInfo: { 
                    "STARTDATE": { type: oracledb.STRING },
                    "ENDDATE": { type: oracledb.STRING }
                }
            });
            console.log(`Query executed successfully. Found ${result.rows.length} rows.`);

            this.syncStatus.totalItems = result.rows.length;

            console.log('Processing and saving data to MongoDB...');
            const batchSize = 1000; // Adjust based on your system's capacity
            for (let i = 0; i < result.rows.length; i += batchSize) {
                const batch = result.rows.slice(i, i + batchSize);
                const operations = batch.map(row => ({
                    updateOne: {
                        filter: { sku: row.SKU },
                        update: {
                            $set: {
                                barcode: row.BARCODE,
                                short_desc: row.SHORT_DESC,
                                longDesc: row.LONGDESC,
                                length: row.LENGTH,
                                width: row.WIDTH,
                                height: row.HEIGHT,
                                weight: row.WEIGHT,
                                unitOfMeasure: row.UNITOFMEASURE,
                                unitOfWeight: row.UNITOFWEIGHT,
                                locationOne: row.LOCATION1,
                                shelvingOne: row.SHELVING1,
                                locationTwo: row.LOCATION2,
                                shelvingTwo: row.SHELVING2,
                                locationThree: row.LOCATION3,
                                shelvingThree: row.SHELVING3,
                                locationFour: row.LOCATION4,
                                shelvingFour: row.SHELVING4,
                                locationFive: row.LOCATION5,
                                shelvingFive: row.SHELVING5,
                                soh: row.SOH,
                                hrg_normal: row.HRG_NORMAL,
                                hrgPromo: row.HRGPROMO,
                                disc: row.DISC,
                                hsp: row.HSP,
                                startDate: row.STARTDATE,
                                endDate: row.ENDDATE
                            }
                        },
                        upsert: true
                    }
                }));

                try {
                    const bulkWriteResult = await Product.bulkWrite(operations);
                    this.syncStatus.successfulInserts += bulkWriteResult.upsertedCount + bulkWriteResult.modifiedCount;
                } catch (error) {
                    console.error(`Error in batch starting at index ${i}:`, error);
                    this.syncStatus.failedInserts += batchSize;
                }

                this.syncStatus.processedItems += batch.length;
                console.log(`Processed ${this.syncStatus.processedItems} out of ${this.syncStatus.totalItems}`);
            }

            console.log('Data processing completed');
            console.log(`Successful inserts/updates: ${this.syncStatus.successfulInserts}`);
            console.log(`Failed inserts/updates: ${this.syncStatus.failedInserts}`);

            this.syncStatus.lastSuccess = new Date();

            return {
                status: 'success',
                totalProcessed: this.syncStatus.processedItems,
                successfulInserts: this.syncStatus.successfulInserts,
                failedInserts: this.syncStatus.failedInserts
            };

        } catch (err) {
            console.error('Error during synchronization:', err);
            this.syncStatus.lastError = err.message;
            return {
                status: 'error',
                message: "Gagal mendapatkan atau memproses data",
                error: err.message
            };
        } finally {
            this.syncStatus.isRunning = false;
            if (connection) {
                try {
                    await connection.close();
                    console.log('Oracle connection closed');
                } catch (err) {
                    console.error('Error closing Oracle connection:', err);
                }
            }
        }
    }

    static getStatus() {
        return {
            ...this.syncStatus,
            progress: this.syncStatus.totalItems
                ? Math.round((this.syncStatus.processedItems / this.syncStatus.totalItems) * 100)
                : 0
        };
    }
}

module.exports = GoldService;