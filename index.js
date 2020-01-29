const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const poseRoute = require('./routes/posebrain');
//const poseRouteVideo = require('./routes/poseVideo');
const app = express();
const API_PORT = 3000;


app.use(bodyParser.urlencoded({extended: true}));
app.use(cors());
app.use(bodyParser.json());

app.get('/', (req, res) => {
    res.send('Node JS server is up and running');
});

app.use('/posebrain', poseRoute);
//app.use('/posebrain', poseRouteVideo);

app.listen(API_PORT, () => console.log(`Server running on ${API_PORT}`));


