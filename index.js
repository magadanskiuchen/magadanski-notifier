'use strict';

const express = require('express');
const https = require('https');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const config = require('config');

var app = express();
app.set('port', process.env.PORT || 5000);
app.use(bodyParser.json({ verify: verifyRequestSignature }));
app.use(express.static('public'));

const APP_SECRET = (process.env.NOTIFIER_APP_SECRET) ? process.env.NOTIFIER_APP_SECRET : config.get('appSecret');
const VALIDATION_TOKEN = (process.env.NOTIFIER_VALIDATION_TOKEN) ? (process.env.NOTIFIER_VALIDATION_TOKEN) : config.get('validationToken');
const PAGE_ACCESS_TOKEN = (process.env.NOTIFIER_PAGE_ACCESS_TOKEN) ? (process.env.NOTIFIER_PAGE_ACCESS_TOKEN) : config.get('pageAccessToken');
const SERVER_URL = (process.env.SERVER_URL) ? (process.env.SERVER_URL) : config.get('serverURL');

if (!(APP_SECRET && VALIDATION_TOKEN && PAGE_ACCESS_TOKEN && SERVER_URL)) {
	console.error("Missing config values");
	process.exit(1);
}

app.get('/', function (req, res) {
	if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === VALIDATION_TOKEN) {
		console.log("Validating webhook");
		res.status(200).send(req.query['hub.challenge']);
	} else {
		console.error("Failed validation. Make sure the validation tokens match.");
		res.sendStatus(403);
	}
});

app.post('/webhook', function (req, res) {
	if (req.body.object === 'page') {
		req.body.entry.forEach(function (entry) {
			var pageID = entry.id;
			var timeOfEvent = entry.time;
			
			entry.messaging.forEach(function (event) {
				if (event.message) {
					receivedMessage(event);
				} else {
					console.log("Webhook received unknown event: ", event);
				}
			});
		});
		
		res.sendStatus(200);
  }
});

function verifyRequestSignature(req, res, buf) {
	var signature = req.headers["x-hub-signature"];
	
	if (!signature) {
		console.error("Couldn't validate the signature.");
	} else {
		var elements = signature.split('=');
		var method = elements[0];
		var signatureHash = elements[1];
		
		var expectedHash = crypto.createHmac(method, APP_SECRET)
			.update(buf)
			.digest('hex');
		
		if (signatureHash != expectedHash) {
			throw new Error("Couldn't validate the request signature.\nRequested signature: " + signature + "\nSHA1: " + crypto.createHmac('sha1', APP_SECRET) + "\nBuf: " + buf + "\nExpected signature: " + expectedHash);
		}
	}
}

function receivedMessage(event) {
	var senderID = event.sender.id;
	var recipientID = event.recipient.id;
	var timeOfMessage = event.timestamp;
	var message = event.message;
	
	console.log("Received message for user %d and page %d at %d with message:", senderID, recipientID, timeOfMessage);
	console.log(JSON.stringify(message));
	
	var messageId = message.mid;
	var messageText = message.text;
	var messageAttachments = message.attachments;
	
	if (messageText) {
		switch (messageText) {
			case 'generic':
			sendGenericMessage(senderID);
			break;
		
		default:
			sendTextMessage(senderID, messageText);
		}
	} else if (messageAttachments) {
		sendTextMessage(senderID, "Message with attachment received");
	}
}

function sendGenericMessage(recipientId) {
	sendTextMessage(recipientId, 'This is a response to a message of "generic"');
}

function sendTextMessage(recipientId, messageText) {
	var messageData = {
		recipient: {
			id: recipientId
		},
		message: {
			text: messageText
		}
	};
	
	callSendAPI(messageData);
}

function callSendAPI(messageData) {
	request({
		uri: 'https://graph.facebook.com/v2.6/me/messages',
		qs: { access_token: PAGE_ACCESS_TOKEN },
		method: 'POST',
		json: messageData
	}, function (error, response, body) {
		if (!error && response.statusCode == 200) {
			var recipientId = body.recipient_id;
			var messageId = body.message_id;
			
			console.log("Successfully sent generic message with id %s to recipient %s", messageId, recipientId);
		} else {
			console.error("Unable to send message.");
			console.error(response);
			console.error(error);
		}
	});
}

app.listen(app.get('port'), function () {
	console.log('Node app is running on port', app.get('port'));
});

module.exports = app;