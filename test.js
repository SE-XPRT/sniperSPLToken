import fetchNewToken from './fetchNewToken.js';

fetchNewToken()
    .then(tokens => {
        console.log('New tokens fetched:', tokens);
    })
    .catch(error => {
        console.error('Error fetching new tokens:', error);
    });