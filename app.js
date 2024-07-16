const express = require('express');
const router = require('./routes');
const limitter = require('express-rate-limit');
const fs = require('fs');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
const port = 3000;
const fileUpload = require('express-fileupload');

app.use(express.json());
app.use(bodyParser.json());
app.use(cors());
app.use(fileUpload());

// Use the router for handling routes
app.use(router);

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
