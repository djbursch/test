const AWS = require('aws-sdk');
AWS.config.update({region:'us-west-1'});
const ddb = new AWS.DynamoDB.DocumentClient();
const express = require('express');
const router = express.Router();
const posenet = require('@tensorflow-models/posenet');
const tf = require('@tensorflow/tfjs');
//const tf = require('@tensorflow/tfjs-node');
//require('@tensorflow/tfjs-node');
const { createCanvas, Image } = require('canvas');
const imageScaleFactor = 0.5;
const outputStride = 16;
const flipHorizontal = false;
const fs = require('fs');
const image_size = require('image-size');
const bodyParser = require('body-parser');
const multer = require('multer');
const randomBytes = require('crypto').randomBytes;
var framesPath = './frames'
//var videosPath = './videos/'
const rimraf = require('rimraf')
var ffmpeg = require('ffmpeg');
var FfmpegCommand = require('fluent-ffmpeg')
var ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
FfmpegCommand.setFfmpegPath(ffmpegPath);

router.use(bodyParser.json());
//Create a storage to keep the images that are being uploade to the server 
const Storage = multer.diskStorage({
    destination(req, file, callback){
        callback(null, './uploads');
    },
    filename(req, file, callback){
        callback(null, `${file.originalname}`);
    },
});


const upload = multer({ storage: Storage}); //Create a variable to route the saving of our images on the server

router.get('/pose', function(req,res){
        res.send({type: 'GET'});
        });

router.post('/video', upload.single('poseImage'), (req,res) =>{
try {
    var process = new ffmpeg(req.file.path);
    process.then(function (video) {
        // Callback mode
        video.fnExtractFrameToJPG(framesPath, {
            number: 90,          
            file_name : 'pic'
        }, function (error, files) {
            if (!error)
                console.log('Frames: ' + files);
		videoModel();
        });
    }, function (err) {
        console.log('Error: ' + err);
    });
} catch (e) {
    console.log(e.code);
    console.log(e.msg);
}
const videoModel = async() => {

    console.log('start');
    var avgConf = 0;
    const net = await posenet.load({
        architecture: 'MobileNetV1',
        outputStride: 16,
        inputResolution: 513,
        multiplier: 0.75
    });

var frames = 90;
for(var i = 1; i < frames; i++){

    //FOR NORMAL IMAGE
    var frameName = framesPath + '/pic_' + i + '.jpg';
    console.log(frameName);
    var img = new Image();
    img.src = frameName;   
    var canvas = createCanvas(img.width, img.height);
    var ctx = canvas.getContext('2d');
    var input = await tf.browser.fromPixels(canvas);
    var pose = await net.estimateSinglePose(input, imageScaleFactor, flipHorizontal, outputStride);
    var poseLength = pose.keypoints.length;
    console.log(pose);
    
    //FOR FLIPPED IMAGE           
    ctx.translate(0, img.height);
    ctx.scale(1, -1);
    ctx.drawImage(img, 0, 0);
    var input2 = await tf.browser.fromPixels(canvas);
    var pose2 = await net.estimateSinglePose(input2, imageScaleFactor, flipHorizontal, outputStride);
    console.log(pose2);
    ctx.translate(0, img.height);
    ctx.scale(1, -1);
    ctx.drawImage(img, 0, 0);
            
    //Choosing the best points       
    for(var h = 0; h < poseLength; h++){
        if(pose.keypoints[h].score < pose2.keypoints[h].score){
            pose.keypoints[h] = pose2.keypoints[h];
            pose.keypoints[h].position.y = img.height - pose2.keypoints[h].position.y;
            }
    }           
            
    //average confidence score -- good for testing
    if (pose.score > pose2.score){
        avgConf = avgConf + pose.score;
    } else{
        avgConf = avgConf + pose2.score;
    }
    /*
    for(const keypoint of pose.keypoints) {
        console.log(`${keypoint.part}: (${keypoint.position.x},${keypoint.position.y})`);
    }
    console.log('end');
    */

    //Which points do we wanna let in?
    var confindenceCutOff1 = .48;
    var confindenceCutOff2 = .65;
    ctx.fillStyle = "#FF0000";
    var rectSize = 15;
    var j;

        for (j = 0; j < poseLength; j++){
            if(pose.keypoints[j].score > confindenceCutOff1 ){
                ctx.fillRect(pose.keypoints[j].position.x, pose.keypoints[j].position.y, rectSize, rectSize);
            }
        }

//save the points to mongodb
/*
if (pose.score > .1){
        await saveImage(pose);
        console.log('image was saved yo!');
       } else{
        //need to put an error message here that returns back to user
        console.log('Your pose sucks! Try again!');
        console.log('I mean your pose was only ', pose.score);
       }    
*/

//write file as a png to framepath
   var buf = canvas.toBuffer();

    fs.writeFile(framesPath  + '/pic' + i + '.png', buf, 'base64', function(err) {
        console.log(err);
    });

//clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    
}
}
//videoModel();
//compileVideo(framesPath);

});//end of post method

router.post('/pose', upload.single('poseImage'), (req, res) => {
    
    var imageData = fs.readFileSync(req.file.path); //get the image from our directory

    const tryModel = async () => {

        console.log('start');

        const net = await posenet.load({
            architecture: 'MobileNetV1',
            outputStride: 16,
            inputResolution: 513,
            multiplier: 0.75,
        });

        const image_dimensions = image_size(imageData);

        const img = new Image();
        img.src = imageData;
        img.width = image_dimensions.width;
        img.height = image_dimensions.height;       
        const canvas = createCanvas(img.width, img.height);
        const ctx = canvas.getContext('2d');
         ctx.drawImage(img, 0, 0);
        const input = await tf.browser.fromPixels(canvas);
        const pose = await net.estimateSinglePose(input, imageScaleFactor, flipHorizontal, outputStride);
        console.log(pose); 
        
        //FOR FLIPPED IMAGE ACROSS X-AXIS       
        ctx.translate(0, img.height);
        ctx.scale(1, -1);
        ctx.drawImage(img, 0, 0);
        var input2 = await tf.browser.fromPixels(canvas);
        var pose2 = await net.estimateSinglePose(input2, imageScaleFactor, flipHorizontal, outputStride);
        console.log(pose2);
        ctx.translate(0, img.height);
        ctx.scale(1, -1);
        ctx.drawImage(img, 0, 0);
        
        //Choosing the best points       
         for(var h = 0; h < poseLength; h++){
                if(pose.keypoints[h].score < pose2.keypoints[h].score){
                    pose.keypoints[h] = pose2.keypoints[h];
                    pose.keypoints[h].position.y = img.height - pose2.keypoints[h].position.y;
                    }  

        for(const keypoint of pose.keypoints){
            console.log(`${keypoint.part}: (${keypoint.position.x},${keypoint.position.y})`);
        }
        

        console.log('end');

        var rectSize = 15;
        var poseLength = pose.keypoints.length;
        var i;
        for(i=0; i < poseLength; i++){
            ctx.fillRect(pose.keypoints[i].position.x, pose.keypoints[i].position.y, rectSize, rectSize);
        }

        //draw the lines on the image and connect the points with lines
        ctx.moveTo(pose.keypoints[5].position.x, pose.keypoints[5].position.y);
        ctx.lineTo(pose.keypoints[6].position.x, pose.keypoints[6].position.y);
        ctx.stroke();
        ctx.moveTo(pose.keypoints[5].position.x, pose.keypoints[5].position.y);
        ctx.lineTo(pose.keypoints[7].position.x, pose.keypoints[7].position.y);
        ctx.stroke();
        ctx.moveTo(pose.keypoints[7].position.x, pose.keypoints[7].position.y);
        ctx.lineTo(pose.keypoints[9].position.x, pose.keypoints[9].position.y);
        ctx.stroke();
        ctx.moveTo(pose.keypoints[5].position.x, pose.keypoints[5].position.y);
        ctx.lineTo(pose.keypoints[11].position.x, pose.keypoints[11].position.y);
        ctx.stroke();
        ctx.moveTo(pose.keypoints[6].position.x, pose.keypoints[6].position.y);
        ctx.lineTo(pose.keypoints[8].position.x, pose.keypoints[8].position.y);
        ctx.stroke();
        ctx.moveTo(pose.keypoints[8].position.x, pose.keypoints[8].position.y);
        ctx.lineTo(pose.keypoints[10].position.x, pose.keypoints[10].position.y);
        ctx.stroke();
        ctx.moveTo(pose.keypoints[6].position.x, pose.keypoints[6].position.y);
        ctx.lineTo(pose.keypoints[12].position.x, pose.keypoints[12].position.y);
        ctx.stroke();
        ctx.moveTo(pose.keypoints[11].position.x, pose.keypoints[11].position.y);
        ctx.lineTo(pose.keypoints[13].position.x, pose.keypoints[13].position.y);
        ctx.stroke();
        ctx.moveTo(pose.keypoints[12].position.x, pose.keypoints[12].position.y);
        ctx.lineTo(pose.keypoints[14].position.x, pose.keypoints[14].position.y);
        ctx.stroke();
        ctx.moveTo(pose.keypoints[13].position.x, pose.keypoints[13].position.y);
        ctx.lineTo(pose.keypoints[15].position.x, pose.keypoints[15].position.y);
        ctx.stroke();
        ctx.moveTo(pose.keypoints[14].position.x, pose.keypoints[14].position.y);
        ctx.lineTo(pose.keypoints[16].position.x, pose.keypoints[16].position.y);
        ctx.stroke();
        ctx.moveTo(pose.keypoints[11].position.x, pose.keypoints[11].position.y);
        ctx.lineTo(pose.keypoints[12].position.x, pose.keypoints[12].position.y);
        ctx.stroke();

        var buf = canvas.toBuffer();
            fs.writeFile('./uploads/'+req.file.originalname, buf, function(err) {
            console.log(err)
        })
        
        //SAVE IMAGE TO DYNAMODB
        const poseId = toUrlString(randomBytes(16));    
        recordPose(poseId, pose);

        res.status(200).json({
            message: 'Successfull analysis! Body keypoints database.',
            imageName: req.file.originalname,
            //binaryData: buf, //sending the binary data so that we can render image on the client side
        })


    };//end of tryModel method

}
    tryModel();

});//end of post method


function recordPose(poseId, pose) {
    ddb.put({
        TableName: 'Pose',
        Item: {
            PoseId: poseId,
            Pose: pose,
            postTime: new Date().toISOString(),
        },
    }).promise();
}

function toUrlString(buffer) {
    return buffer.toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

function errorResponse(errorMessage, awsRequestId, callback) {
  callback(null, {
    statusCode: 500,
    body: JSON.stringify({
      Error: errorMessage,
      Reference: awsRequestId,
    }),
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
  });
}

function compileVideo(framesPath){

//finished video
console.log('All done!!');
avgConf = avgConf/i;
console.log(avgConf);

//put all new frames back into video
var proc = new FfmpegCommand();
proc.addInput(framesPath + 'pic%1d.png')
.on('start', function(ffmpegCommand) {
    console.log('video started loading');
})
.on('progress', function(data) {
console.log('video is loading...');
})
.on('end', function() {
    console.log('video ended loading');
    //DELTES ALL in path, need to make folders for specific frames
    rimraf(framePath , function () { console.log('done with deleting all frames'); });
})
.on('error', function(error) {
    /// error handling
})
.addInputOption('-framerate 20')
.outputOptions(['-vcodec libx264', '-r 60', '-pix_fmt yuv420p'])
.output(videoPath + avgConf + 'firstTestFlipCONTRAST.mp4')
.run();
}



module.exports = router;
