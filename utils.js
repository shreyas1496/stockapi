
const CONFIG_KEY = "4F8vvNAcnybx6ofwvWF6";
const CONFIG_COLLECTION_NAME = "config";

const getConfig = async ({ firestore }) => {
    const ref = firestore.collection(CONFIG_COLLECTION_NAME);
    const configDoc = await ref.doc(CONFIG_KEY).get();

    if (configDoc.exists) {
        return configDoc.data(); // Returns the document data as an object
    } else {
        throw new Error(`Document with key ${CONFIG_KEY} does not exist in collection ${CONFIG_COLLECTION_NAME}`);
    }
}


const updateConfig = async (newConfig, { firestore }) => {
    const ref = firestore.collection(CONFIG_COLLECTION_NAME);
    await ref.doc(CONFIG_KEY).set(newConfig, {merge: true});
    return;
}

const html = () => {
    return {
        head: `
            <head>
        <style>
        table {
        font-family: arial, sans-serif;
        border-collapse: collapse;
        width: 100%;
        }

        td, th {
        border: 1px solid #dddddd;
        text-align: left;
        padding: 8px;
        }

        tr:nth-child(even) {
        background-color: #dddddd;
        }

        .top-nav {
            background-color: #f0f0f0; /* Light gray background for contrast */
            border-bottom: 2px solid #ccc; /* Subtle bottom border */
            overflow: hidden;
            display: flex;
            justify-content: center;
            padding: 0.5rem;
        }

        .top-nav a {
            color: #333; /* Dark text color for readability */
            background-color: #e7e7e7; /* Light background color for buttons */
            border: 1px solid #ccc; /* Subtle border */
            padding: 0.75rem 1.5rem;
            text-decoration: none;
            text-align: center;
            font-size: 1rem;
            border-radius: 5px;
            margin: 0 0.5rem;
        }

        .top-nav a:hover {
            background-color: #d4d4d4; /* Darker gray on hover */
        }
        </style>
        </head>
            `,
        navBar: `<div class="top-nav">
        <a href="/api/summary">Orders</a>
        <a href="/api/transactions">Transactions</a>
    </div>`
    }
}

module.exports = {
    getConfig, updateConfig, html
}