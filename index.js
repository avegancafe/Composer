(function () {
  'use strict';

  var client_id = '70de0f71b89273d18e28';
  var client_secret = '79d15f634d815d3294b81122e825b9bb7a2d3e41';
  var redirectUri = 'https://' + chrome.runtime.id + '.chromiumapp.org';

  function submit() {
    var title = document.getElementById('title');
    var blogpost = document.getElementById('blogpost');

    chrome.storage.local.get('token', function (data) {
      var token = data.token;
      if (!token) {
        auth(function (newToken) {
          postToGithub(newToken);
        });
      } else {
        postToGithub(token);
      }
    });
  }

  function clearFields() {
    document.getElementById('blogpost').value = '';
    document.getElementById('title').value = '';
  }

  function auth (callback) {
    chrome.identity.launchWebAuthFlow({
        'url': 'https://github.com/login/oauth/authorize?client_id=' + client_id +
               '&redirect_uri='+ encodeURIComponent(redirectUri) +
               '&scope=repo',
        'interactive': true,
      },
      function(redirect_url) { 
        var code = redirect_url.match(/.+\?code=(.+)/)[1];
        getNewToken(code, callback);
    });
  }

  function getNewToken (code, callback) {
    var xmlhttp = new XMLHttpRequest();
    var url = 'https://github.com/login/oauth/access_token?client_id=' + client_id +
           '&client_secret=' + client_secret +
           '&code=' + code;
    xmlhttp.open('POST', url);
    xmlhttp.onload = function (res) {
      var newToken = res.target.response.match(/.*access_token=([^\&]*)/)[1];
      chrome.storage.local.set({
        token: newToken
      });
      callback(newToken);
    };
    xmlhttp.send();
  }

  function postToGithub(token) {
    committerInfo(token, function (username) {
      var params;
      var url;
      var xmlhttp = new XMLHttpRequest();

      if (!username) return;
      url = 'https://api.github.com/repos/';
      params =  encodeURIComponent(username) +
        '/' + encodeURIComponent(username + '.github.io') +
        '/contents/_posts/' + fileName();

      xmlhttp.open('PUT', url + params);

      xmlhttp.setRequestHeader('Authorization', 'token ' + token);

      xmlhttp.onload = function(res) {
        if (res.target.status !== 201) {
          auth(function (newToken) {
            postToGithub(newToken);
          });
        } else {
          window.lightbox("Posted!")
          clearFields();
          setTimeout(function () {
            window.removeLightbox()
          }, 500);
        }
      };
      xmlhttp.send(JSON.stringify({
          'path': '_posts/' + fileName(),
          'message': 'New blog post: ' + formattedTitle(),
          'content': formattedContent()
        })
      );
    });
    return;
  }

  function committerInfo(token, callback) {
    var xmlhttp = new XMLHttpRequest();
    var url = 'https://api.github.com/user';
    xmlhttp.open('GET', url);
    xmlhttp.onload = function (data) {
      var res = JSON.parse(data.target.response);
      callback(res.login);
    };
    xmlhttp.setRequestHeader('Authorization', 'token ' + token);

    xmlhttp.send();
  }

  function fileName() {
    return formattedDate() + '-' + formattedTitle() + '.markdown';
  }

  function formattedDate() {
    var cur = new Date();
    var leftpad = function (old, length, str) {
      if (old.length >= length) {
        return old;
      }
      str = str || ' ';
      return (new Array(Math.ceil((length - old.length) / str.length) + 1).join(str))
        .substr(0, (length - old.length)) + old;
    };
    return cur.getFullYear() + '-' +
      leftpad(cur.getMonth() + 1 + '', 2, '0') + '-' +
      leftpad(cur.getDate() + '', 2, '0');
  }

  function formattedTitle() {
    return document.getElementById('title').value.toLowerCase().split(' ').join('-');
  }

  function formattedContent() {
    var fin = '';
    fin += buildHeader();
    fin += document.getElementById('blogpost').value;
    if (fin[fin.length] !== '\n') fin += '\n';
    return btoa(fin);
  }

  function buildHeader() {
    return '---\n' +
           'layout: post\n' +
           'title: ' + document.getElementById('title').value + '\n' +
           'date: ' + buildDate() + '\n' +
           'published: true\n' +
           '---\n';
  }

  function buildDate() {
    var now = '' + new Date();
    return '' + formattedDate() + ' ' +
           now.match(/.*[\d]{4}\s(.+)\s[^\(].*/)[1] + ' ' +
           now.match(/.*([-|\+]\d{4}).*/)[1]; // (-|+)dddd
  }

  document.getElementById('submit').onclick = submit;
})();
