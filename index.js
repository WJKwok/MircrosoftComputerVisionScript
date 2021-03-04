'use strict';
require('dotenv').config();
const async = require('async');
const fs = require('fs');
const https = require('https');
const path = require('path');
const createReadStream = require('fs').createReadStream;
const sleep = require('util').promisify(setTimeout);
const ComputerVisionClient = require('@azure/cognitiveservices-computervision')
	.ComputerVisionClient;
const ApiKeyCredentials = require('@azure/ms-rest-js').ApiKeyCredentials;

const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const csvWriter = createCsvWriter({
	path: './file.csv',
	header: [
		{ id: 'url', title: 'URL' },
		{ id: 'description', title: 'DESCRIPTION' },
		{ id: 'confidence', title: 'CONFIDENCE' },
		{ id: 'tags', title: 'TAGS' },
	],
	append: true,
});

const csvParser = require('csv-parser');

// <snippet_vars>
/**
 * AUTHENTICATE
 * This single client is used for all examples.
 */
const key = process.env.COMPUTER_VISION_KEY;
const endpoint = process.env.COMPUTER_VISION_ENDPOINT;
// </snippet_vars>

// <snippet_client>
const computerVisionClient = new ComputerVisionClient(
	new ApiKeyCredentials({ inHeader: { 'Ocp-Apim-Subscription-Key': key } }),
	endpoint
);
// </snippet_client>
/**
 * END - Authenticate
 */

// <snippet_functiondef_begin>
function computerVision() {
	async.series(
		[
			async function () {
				const fd = fs
					.createReadStream('./sample.csv')
					.pipe(csvParser())
					.on('data', async (data) => {
						try {
							fd.pause();
							await Promise.all([timeout(5000), queryCV(data)]);
						} catch (err) {
							console.log(`err fetching ${data.URL}`);
							const records = [
								{
									url: data.URL,
									description: 'ERROR',
									confidence: 'ERROR',
									tags: 'ERROR',
								},
							];

							csvWriter
								.writeRecords(records) // returns a promise
								.then(() => {
									console.log('...Done');
								});
						} finally {
							fd.resume();
						}
					})
					.on('end', () => {
						console.log('All done');
					});

				function timeout(ms) {
					return new Promise((resolve) => setTimeout(resolve, ms));
				}
				async function queryCV(data) {
					console.log(
						'Analyzing URL image to describe...',
						data.URL.split('/').pop()
					);

					const caption = (await computerVisionClient.describeImage(data.URL))
						.captions[0];

					const tags = (
						await computerVisionClient.analyzeImage(data.URL, {
							visualFeatures: ['Tags'],
						})
					).tags;

					console.log(
						`This may be ${caption.text} (${caption.confidence.toFixed(
							2
						)} confidence) and the tags are ${formatTags(tags)}`
					);

					const records = [
						{
							url: data.URL,
							description: caption.text,
							confidence: caption.confidence.toFixed(2),
							tags: formatTags(tags),
						},
					];

					csvWriter
						.writeRecords(records) // returns a promise
						.then(() => {
							console.log('...Done');
						});

					return;
				}

				function formatTags(tags) {
					return tags
						.map((tag) => `${tag.name} (${tag.confidence.toFixed(2)})`)
						.join(', ');
				}
			},
			function () {
				return new Promise((resolve) => {
					resolve();
				});
			},
		],
		(err) => {
			throw err;
		}
	);
}

computerVision();
