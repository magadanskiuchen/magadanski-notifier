'use strict';

const express = require('express');
const https = require('https');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const config = require('config');

var app = express();
app.set('port', process.env.PORT || 80);
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

function verifyRequestSignature(req, res, buf) {
	var signature = req.headers["x-hub-signature"];
	
	if (!signature) {
		console.error("Couldn't validate the signature.");
	} else {
		var elements = signature.split('=');
		var method = elements[0];
		var signatureHash = elements[1];
		
		var expectedHash = crypto.createHmac('sha1', APP_SECRET)
			.update(buf)
			.digest('hex');
		
		if (signatureHash != expectedHash) {
			throw new Error("Couldn't validate the request signature.");
		}
	}
}

app.listen(app.get('port'), function () {
	console.log('Node app is running on port', app.get('port'));
});

module.exports = app;