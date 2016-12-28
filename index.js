'use strict';

const express = require('express');

var app = express();

app.get('/', function (req, res) {
	if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === '^sdB]~"i4+1v 3b') {
		console.log("Validating webhook");
		res.status(200).send(req.query['hub.challenge']);
	} else {
		console.error("Failed validation. Make sure the validation tokens match.");
		res.sendStatus(403);
	}
});