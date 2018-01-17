Package.describe({
	name: 'equichain:slashcommands-finance',
	version: '0.0.1',
	summary: 'Message pre-processor that will add finance related messages with slash commands, ' +
	'which will trigger extra handling in another finance explorer app',
	git: ''
});

Package.onUse(function(api) {
	api.versionsFrom('1.0');

	api.use([
		'rocketchat:lib'
	]);

	api.use('ecmascript');

	api.addFiles('ioi.js', ['server', 'client']);
});
