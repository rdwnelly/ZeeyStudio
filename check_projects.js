const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, where } = require('firebase/firestore');

// We need the firebase config to init. 
// Or we can just use curl to get the client id page.
