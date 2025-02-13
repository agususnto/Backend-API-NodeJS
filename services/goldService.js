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

    static async fetchAndSaveGoldData() {
        let connection;
        try {
            // Update sync status
            this.syncStatus.isRunning = true;
            this.syncStatus.lastRun = new Date();
            this.syncStatus.lastError = null;
            this.syncStatus.processedItems = 0;
            this.syncStatus.successfulInserts = 0;
            this.syncStatus.failedInserts = 0;

            // Get configuration from environment variables
            const site = process.env.SITE;
            const brands = (process.env.BRANDS).split(',').map(brand => `'${brand.trim()}'`).join(',');

            // Connect to Oracle
            connection = await oracledb.getConnection({
                user: process.env.DB_USER,
                password: process.env.DB_PASSWORD,
                connectString: process.env.DB_CONNECTION_STRING
            });

            // Define the query with corrected bind variables
            const query = `with art as 
(
select DISTINCT
	acacinv,
	acasite,
	acalibc,
	acaprix
from 
	artcaisse 
where 
	acasite = :v_site
	and acaacti <2
	and exists(
			select 1 from 
				artuv, ARTATTRI
			WHERE
				arvcinv = acacinv
				and arvcinr = aatcinr
				and aatccla in ('BRAND', 'BRANDSM')
				and trunc(sysdate) between aatddeb and aatdfin
				and aatcatt in (${brands})
	 )
),
promo as
(
select
	 site,
	 cinv,
	 (
			 case
					 when promo1a is not null then promo1a
					 when promo2 is not null then promo2
					 else promo1b
			 end
	 ) promocode,
	 decode(promo2, null, null, kdspkmixmatch.get_fixprice(promo2, cinv)) fprice,
	 decode(promo1a, null, null, nvl(kdspkmixmatch.get_listval(promo1a, 'DISC1'), null)) disc1,
	 decode(promo1a, null, null, nvl(kdspkmixmatch.get_listval(promo1a, 'DISC2'), null)) disc2,
	 decode(promo1a, null, null, nvl(kdspkmixmatch.get_listval(promo1a, 'DISC3'), null)) disc3,
	 decode(promo1a, null, null, nvl(kdspkmixmatch.get_listval(promo1a, 'DISCRP'), null)) discrp,
	 decode(promo1b, null, null, nvl(kdspkmixmatch.get_listval(promo1b, 'DISCM1'), null)) discm1,
	 decode(promo1b, null, null, nvl(kdspkmixmatch.get_listval(promo1b, 'DISCM2'), null)) discm2,
	 decode(promo1b, null, null, nvl(kdspkmixmatch.get_listval(promo1b, 'DISCM3'), null)) discm3,
	 decode(promo1b, null, null, nvl(kdspkmixmatch.get_listval(promo1b, 'DISCMRP'), null)) discmrp,
	 (
			 case
					 when promo1a is not null then ermddeb1a
					 when promo2 is not null then ermddeb2
					 else ermddeb1b
			 end
	 ) ermddeb,
	 (
			 case
					 when promo1a is not null then ermdfin1a
					 when promo2 is not null then ermdfin2
					 else ermdfin1b
			 end
	 ) ermdfin
from
	 kdspromotion,
	 (select ermndis, to_date(concat(to_char(ermddeb, 'dd/mm/yy'),nvl(ermhdeb, '0000')), 'dd/mm/yyHH24MI') ermddeb1a, to_date(concat(to_char(ermdfin, 'dd/mm/yy'),nvl(ermhfin, '2359')), 'dd/mm/yyHH24MI') ermdfin1a from mixentpos where ermdnum = 1) mix1a,
	 (select ermndis, to_date(concat(to_char(ermddeb, 'dd/mm/yy'),nvl(ermhdeb, '0000')), 'dd/mm/yyHH24MI') ermddeb1b, to_date(concat(to_char(ermdfin, 'dd/mm/yy'),nvl(ermhfin, '2359')), 'dd/mm/yyHH24MI') ermdfin1b from mixentpos where ermdnum = 1) mix1b,
	 (select ermndis, to_date(concat(to_char(ermddeb, 'dd/mm/yy'),nvl(ermhdeb, '0000')), 'dd/mm/yyHH24MI') ermddeb2, to_date(concat(to_char(ermdfin, 'dd/mm/yy'),nvl(ermhfin, '2359')), 'dd/mm/yyHH24MI') ermdfin2 from mixentpos where ermdnum = 2) mix2
where
	 trunc(promodate) = trunc(sysdate)
	 and promo1a = mix1a.ermndis(+)
	 and promo1b = mix1b.ermndis(+)
	 and promo2 = mix2.ermndis(+)
	 and site = :v_site
	 and exists(
			select 1 from 
				artuv, ARTATTRI
			WHERE
				arvcinv = cinv
				and arvcinr = aatcinr
				and aatccla in ('BRAND', 'BRANDSM')
				and trunc(sysdate) between aatddeb and aatdfin
				and aatcatt in (${brands})
	 )
)
select 
	art.acasite site,
	PKSITDGENE.get_sitedescription(1, art.acasite) sitename,
	pkdwh.get_sku(art.acacinv) sku,
	pkdwh.get_barcode(art.acacinv, 1) barcode1,
	pkdwh.get_barcode(art.acacinv, 2) barcode2,
	pkdwh.get_barcode(art.acacinv, 3) barcode3,
	art.acalibc short_desc,
	art.acaprix harganormal,
	nvl(promo.discrp, promo.discmrp) as HrgPromo,
	nvl(nvl(promo.disc1, nvl(promo.disc2, promo.disc3)), nvl(promo.discm1, nvl(promo.discm2, promo.discm3))) as Disc,
	promo.fprice as HSP,
	promo.ermddeb as StartDate,
	promo.ermdfin as EndDate
from 
	art, 
	promo 
where 
	art.acasite = promo.site(+) 
	and art.acacinv=promo.cinv(+)`;

            // Set up bind variables
            const binds = {
                v_site: site
            };

            console.log('Executing Oracle query...');
            console.log('Using site:', site);
            console.log('Using brands:', brands);

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
                                site: row.SITE,
                                sitename: row.SITENAME,
                                barcode: row.BARCODE1,
								barcode_two: row.BARCODE2,
								barcode_three: row.BARCODE3,
                                short_desc: row.SHORT_DESC,
                                hrg_normal: row.HARGANORMAL,
                                hrgPromo: row.HRGPROMO,
                                discount: row.DISC,
                                hsp: row.HSP,
                                startDate: row.STARTDATE,
                                endDate: row.ENDDATE,
                                lastUpdate: new Date()
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