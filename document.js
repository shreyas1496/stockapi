

// Create a document in the collection
async function handlePostRequest(collectionRef, body, res) {
    try {
        const createdDoc = await collectionRef.add(body);
        return res.status(201).json({ id: createdDoc.id, message: 'Document created successfully.' });
    } catch (error) {
        console.error('Error creating document:', error);
        return res.status(500).json({ message: 'Failed to create document.' });
    }
}

// Get documents from the collection
async function handleGetRequest(collectionRef, documentId, res) {
    try {
        if (documentId) {
            const doc = await collectionRef.doc(documentId).get();
            if (!doc.exists) {
                return res.status(404).json({ message: 'Document not found.' });
            }
            return res.status(200).json({ id: doc.id, ...doc.data() });
        } else {
            const snapshot = await collectionRef.get();
            const documents = snapshot.docs.map(doc => ({ _id: doc.id, ...doc.data() }));
            return res.status(200).json(documents);
        }
    } catch (error) {
        console.error('Error retrieving documents:', error);
        return res.status(500).json({ message: 'Failed to retrieve documents.' });
    }
}

// Get documents by field name and value
async function handleGetByFieldRequest(collectionRef, fieldName, fieldValue, res) {
    try {
        const querySnapshot = await collectionRef.where(fieldName, '==', fieldValue).get();
        if (querySnapshot.empty) {
            return res.status(404).json({ message: 'No documents match the query.' });
        }
        const documents = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return res.status(200).json(documents);
    } catch (error) {
        console.error('Error querying documents by field:', error);
        return res.status(500).json({ message: 'Failed to query documents.' });
    }
}

// Bulk delete documents by field name and value
async function handleBulkDeleteByFieldRequest(collectionRef, fieldName, fieldValue, res) {
    try {
        const querySnapshot = await collectionRef.where(fieldName, '==', fieldValue).get();
        if (querySnapshot.empty) {
            return res.status(404).json({ message: 'No documents match the query.' });
        }
        const batch = collectionRef.firestore.batch();
        querySnapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();
        return res.status(200).json({ message: 'Documents deleted successfully.' });
    } catch (error) {
        console.error('Error deleting documents by field:', error);
        return res.status(500).json({ message: 'Failed to delete documents.' });
    }
}

// Update a document in the collection
async function handlePutRequest(collectionRef, documentId, body, res) {
    try {
        if (!documentId) {
            return res.status(400).json({ message: 'Document ID is required for PUT requests.' });
        }
        await collectionRef.doc(documentId).set(body, { merge: true });
        return res.status(200).json({ message: 'Document updated successfully.' });
    } catch (error) {
        console.error('Error updating document:', error);
        return res.status(500).json({ message: 'Failed to update document.' });
    }
}

// Delete a document from the collection
async function handleDeleteRequest(collectionRef, documentId, res) {
    try {
        if (!documentId) {
            return res.status(400).json({ message: 'Document ID is required for DELETE requests.' });
        }
        await collectionRef.doc(documentId).delete();
        return res.status(200).json({ message: 'Document deleted successfully.' });
    } catch (error) {
        console.error('Error deleting document:', error);
        return res.status(500).json({ message: 'Failed to delete document.' });
    }
}

const handleDocuments = async (req, res, { firestore }) => {
    const [mode, collectionName, documentIdOrField, fieldValue] = req.path.split('/').filter(Boolean);
    const { method, body } = req;
    
    if (!collectionName) {
        return res.status(400).json({ message: 'Collection name is required.' });
    }

    const collectionRef = firestore.collection(collectionName);

    if (method === 'GET' && documentIdOrField && fieldValue) {
        return await handleGetByFieldRequest(collectionRef, documentIdOrField, fieldValue, res);
    }

    if (method === 'DELETE' && documentIdOrField && fieldValue) {
        return await handleBulkDeleteByFieldRequest(collectionRef, documentIdOrField, fieldValue, res);
    }

    switch (method) {
        case 'POST':
            return await handlePostRequest(collectionRef, body, res);
        case 'GET':
            return await handleGetRequest(collectionRef, documentIdOrField, res);
        case 'PUT':
            return await handlePutRequest(collectionRef, documentIdOrField, body, res);
        case 'DELETE':
            return await handleDeleteRequest(collectionRef, documentIdOrField, res);
        default:
            return res.status(405).json({ message: 'Method not allowed.' });
    }
}

module.exports = handleDocuments;

