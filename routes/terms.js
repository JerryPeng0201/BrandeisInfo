var express = require('express');
var router = express.Router();


router.get('/', function(req, res, next) {
  res.render('terms', { title: 'We are serious' });
});

module.exports = router;