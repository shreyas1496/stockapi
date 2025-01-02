const functions = require('@google-cloud/functions-framework');


const admin = require("firebase-admin");

const handleDocument = require("./document.js");
const handleApi = require("./api.js");

admin.initializeApp();
const firestore = admin.firestore();





/**
 * Handles CRUD operations for Firestore collections.
 * @param {Object} req - HTTP request object.
 * @param {Object} res - HTTP response object.
 */
const crudHandler = async (req, res) => {
    try {
        
        const mode = req.path.split('/').filter(Boolean)[0];
        
        switch (mode) {
            case 'document':
                return await handleDocument(req, res, { firestore });
            case 'api':
                return await handleApi(req, res, { firestore });
            default:
                return res.status(400).json({message: `Invalid mode ${mode}, should be document or api`})
        }

        
    } catch (error) {
        console.error('Error handling request:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

// Register the function for Google Cloud Functions
functions.http('crudHandler', crudHandler);
