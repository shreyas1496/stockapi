const { KiteConnect } = require("kiteconnect");
const { updateConfig, getConfig, html } = require("./utils.js");
const admin = require('firebase-admin');
const axios = require("axios");

const apiKey = "6rwz1ojtck3ilued";
const apiSecret = "q4z7g3lwugul46l13xlmdknl14ieaq0c";

const kc = new KiteConnect({ api_key: apiKey });

const loginInit = async (req, res) => {
    res.redirect(kc.getLoginURL());
}

const loginSuccess = async(req, res, others) => {
    const requestToken = req.query.request_token;
    const resp = await kc.generateSession(requestToken, apiSecret);
    const config ={
        access_token: resp.access_token,
        accessToken: resp.access_token
    };
    await updateConfig(config, others);
    return res.status(200).send("token set");

}

const today = () => {
    return new Date().toISOString().split('T')[0]
}



// Function to delete a field across a collection
async function deleteFieldAcrossCollection(req, resp, {firestore}) {
    const collectionName = 'history2';
    const fieldToRemove = 'lowCrossedAt';
    const db = firestore;

  try {
    const snapshot = await db.collection(collectionName).get();

    if (snapshot.empty) {
      console.log('No documents found in the collection.');
      return;
    }

    const batch = db.batch();

    snapshot.forEach(doc => {
      const docRef = db.collection(collectionName).doc(doc.id);
      batch.update(docRef, { [fieldToRemove]: admin.firestore.FieldValue.delete(),
      ['highCrossedAt']: admin.firestore.FieldValue.delete(),
      ['orderTriggeredAt']: admin.firestore.FieldValue.delete() });
    });

    await batch.commit();
    console.log(`Field "${fieldToRemove}" removed from all documents in "${collectionName}".`);
  } catch (error) {
    console.error('Error deleting field:', error);
  }
}

// Call the function


const bulkAdd = async (req, res, { firestore }) => {
    const [mode, type, collection] = req.path.split('/').filter(Boolean);
    const items = req.body;

    const batch = firestore.batch();
    items.forEach(item => {
        const docRef = firestore.collection(collection).doc(); // Generate a new document ID
        batch.set(docRef, item);
    });
    await batch.commit();
    res.status(200).send("Done");
}

const bulkUpdate = async (req, res, { firestore }) => {
    const [mode, type, collection] = req.path.split('/').filter(Boolean);
    const updates = req.body;

    const batch = firestore.batch();
    updates.forEach(update => {
        if (!update.id) {
            return res.status(400).send("Each update item must include an 'id' field.");
        }
        const docRef = firestore.collection(collection).doc(update.id);
        batch.update(docRef, update.data); // Update only the specified fields
    });

    try {
        await batch.commit();
        res.status(200).send("Bulk update successful");
    } catch (error) {
        console.error("Error in bulk update:", error);
        res.status(500).send("Bulk update failed");
    }
};


const storeOHLC = async (req, res, { firestore }) => {
    await axios.delete(`https://add-doc-319067152851.us-central1.run.app/document/history2/date/${today()}`).catch(res => {
        console.log(res.code);
    });
    const tokens_ss = await firestore.collection('tokens').get();
    const config = await getConfig({firestore});
    const tokens = tokens_ss.docs.map(doc => doc.data());
    const kc = new KiteConnect({ api_key: apiKey || '', access_token: config.access_token });
    const instruments = tokens.map(doc => `${doc.exchange}:${doc.tradingsymbol}`)
    const ohlcresp =  await kc.getOHLC(instruments);
    const data = [];
    
    Object.entries(ohlcresp).forEach(([key, item]) => {
        const [exchange, tradingsymbol] = key.split(':');
        data.push({ date: new Date().toISOString().split('T')[0] , exchange, tradingsymbol, instrument_token: item.instrument_token, ltp: item.last_price,  ...item.ohlc })
    });

    const batch = firestore.batch();
    data.forEach(item => {
        const docRef = firestore.collection('history2').doc(); // Generate a new document ID
        batch.set(docRef, item);
    });
    await batch.commit();
    res.status(200).send("Done");
}

function sortByKey(array, key, order = 'asc') {
  return array.sort((a, b) => {
    const valA = a[key] ?? null;
    const valB = b[key] ?? null;

    // Handle cases where values are null or undefined
    if (valA === valB) return 0;

    // Compare strings using localeCompare
    if (typeof valA === 'string' && typeof valB === 'string') {
      const comparison = valA.localeCompare(valB);
      return order === 'asc' ? comparison : -comparison;
    }

    // Compare numbers and other types
    const comparison = valA > valB ? 1 : -1;
    return order === 'asc' ? comparison : -comparison;
  });
}


const summary = async (req, res, { firestore }) => {
    const config = await getConfig({firestore});
    const orders_ss = await firestore.collection(config.ordersTable).where('createdDate', '==', today()).get();
    const orders = orders_ss.docs
    .map(doc => ({ _id: doc.id, ...doc.data() }))
    .map(doc => ({ ...doc, ins: `${doc?.stock?.exchange|| 'NFO'}:${doc.stock.tradingsymbol}`}));
    const sorted = sortByKey(orders, 'createdTime', 'desc');
    const {head, navBar} = html();

    const kc = new KiteConnect({ api_key: apiKey || '', access_token: config.access_token });
    const instruments = sorted.map(item => item.ins);
    const ltpMap = await kc.getLTP(instruments);

    const htmlContent = `
        <!DOCTYPE html>
        <html>
        ${head}
        <body>
        ${navBar}

        <h2>Orders Table</h2>
        <table>
        <tr>
            <th>Time</th>
            <th>Stock</th>
            <th>LTP / Order Trigger Price </th>
            <th>High</th>
            <th>Low</th>
        </tr>
        ${sorted.map(
            (item) => `
            <tr>
            <td>${item.createdTime} ${item.stock.direction}</td>
            <td>${item.stock.tradingsymbol}</td>
            <td> ${ltpMap[item.ins]?.last_price} / ${item.stock.orderTriggeredPrice}</td>
            <td>${item.tick.ohlc.high} at ${item.stock.highCrossedAt} (${item.stock.high})</td>
            <td>${item.tick.ohlc.low} at ${item.stock.lowCrossedAt} (${item.stock.low})</td>
            </tr>
            `
        )}
        
        </table>
        </body>
        </html>
    `;

    res.setHeader('Content-Type', 'text/html');
    res.send(htmlContent);
}


const transactions = async (req, res, { firestore }) => {
    const config = await getConfig({firestore});
    const orders_ss = await firestore.collection(config.transactionsTable).where('createdDate', '==', today()).get();
    const orders = orders_ss.docs.map(doc => ({ _id: doc.id, ...doc.data() }));
    const sorted = sortByKey(orders, 'createdTime', 'desc');
    const {head, navBar} = html();

    const htmlContent = `
        <!DOCTYPE html>
        <html>
        ${head}
        <body>
        ${navBar}

        <h2>Transactions Table</h2>
        <table>
        <tr>
            <th>Time</th>
            <th>Stock</th>
            <th>Profit</th>
            <th>Order</th>
            <th>Target/SL</th>
        </tr>
        ${sorted.map(
            (item) => {
                const {profit, profitBookedAt, orderTriggeredPrice, orderTriggeredAt, targetPrice, stopLossPrice} = item.stock;
                return `<tr>
            <td>${item.createdTime}</td>
            <td>${item.stock.tradingsymbol}</td>
            <td>${profit} at ${profitBookedAt}</td>
            <td>${orderTriggeredPrice} at ${orderTriggeredAt}</td>
            <td>${targetPrice} / ${stopLossPrice}</td>
            </tr>`
            }
            
            
        )}
        
        </table>
        </body>
        </html>
    `;

    res.setHeader('Content-Type', 'text/html');
    res.send(htmlContent);
}


const handleAPI = async (req, res, services) => {
    const [mode, type] = req.path.split('/').filter(Boolean);
    switch (type) {
        case 'loginInit':
            return await loginInit(req, res);
        case 'loginSuccess':
            return await loginSuccess(req, res, services);
        case 'bulkAdd':
            return await bulkAdd(req, res, services);
        case 'bulkUpdate':
            return await bulkUpdate(req, res, services);
        case 'storeOHLC':
            return await storeOHLC(req, res, services);
        case 'summary':
            return await summary(req, res, services);
        case 'transactions':
            return await transactions(req, res, services);
        case 'deleteFieldAcrossCollection':
            return await deleteFieldAcrossCollection(req, res, services);
        default:
             return res.status(405).json({ message: type + ' Method not allowed.' });       
    }
    return res.status(200).json({message: "not implemented"})
}




module.exports = handleAPI;