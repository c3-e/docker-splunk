/*
 * Copyright 2009-2014 C3, Inc. dba C3 Energy (http://www.c3energy.com). All Rights Reserved.
 * This material, including without limitation any software, is the confidential trade secret
 * and proprietary information of C3 Energy and its licensors. Reproduction, use and distribution
 * of this material in any form is strictly prohibited except as set forth in a written
 * license agreement with C3 Energy and/or its authorized distributors.
 */

function applyToSearch(param, value) {
  var replace = '';
  if (value != null) {
    if (value instanceof Array && value.length > 1) {
      if (value.length < 1) {
        // replace with nothing
      }
      if (value.length == 1) {
        // single value
        replace = param + '="' + value + '"';
      } else {
        // multiple values
        replace = '(';
        for (var i = 0; i < value.length; i++) {
          if (i > 0)
            replace += ' OR ';
          replace += param + '="' + value[i] + '"';
        }
        replace += ')';
      }
    } else {
      replace = param + '="' + value + '"';
    }
  }

  var input = $('.search-form :input[name=search]');
  var search = input.val();
  if (search) {
    var expr = new RegExp('\\b' + param + '=("[^"]*"|[^ "][^ ]*) *', 'gi');
    search = search.replace(expr, '');
    search = search.replace(/\(( *OR)* *\)/g, '');
  }
  if (replace)
    search = replace + ' ' + $.trim(search);
  input.val(search);

  setDefaultParam('search', search);
  startSearch();
}

var searchParamChanged = null;

require([
  "splunkjs/ready!",
  "splunkjs/mvc/simplexml/ready!",
], function (mvc) {
  var form = $('.search-form');

  // search bar drop-down menus
  form.find('.dropdown-toggle').dropdown();
  form.find('.btn-group a[role=menuitem]').click(function (e) {
    e.preventDefault();
    var group = $(this).closest('.btn-group');
    var input = group.find('input[type=hidden]');
    var value = $(this).data('value');
    group.find('.dropdown-toggle span').text($(this).text());
    input.val(value);
    if (searchParamChanged != null)
      searchParamChanged(input.attr('name'), value);
    setDefaultParam(input.attr('name'), value);
    startSearch();
  });
  form.find('div.dropdown').each(function () {
    var group = $(this);
    var input = group.find('input[type=hidden]');
    var value = getDefaultParam(input.attr('name'));
    if (value == null) {
      var text = group.find('.dropdown-toggle span').text();
      group.find('a[role=menuitem]').each(function () {
        if ($(this).text() == text)
          value = $(this).data('value');
      });
      if (value == null) {
        group.find('a[role=menuitem]').each(function () {
          if ($(this).hasClass('dropdown-default'))
            value = $(this).data('value');
        });
      }
    } else {
      var text = null;
      group.find('a[role=menuitem]').each(function () {
        if ($(this).data('value') == value)
          text = $(this).text();
      });
      if (text == null) {
        group.find('a[role=menuitem]').each(function () {
          if ($(this).hasClass('dropdown-other'))
            text = $(this).text();
        });
        if (text == null || text === '')
          text = '?';
      }
      group.find('.dropdown-toggle span').text(text);
    }
    input.val(value);
  });

  // search bar enter and form submit
  var input = form.find(':input[name=search]');
  input.bind('keydown', function (e) {
    if (e.keyCode == 13) {
      e.preventDefault();
      setDefaultParam('search', input.val());
      startSearch();
    }
  });
  form.submit(function (e) {
    e.preventDefault();
    setDefaultParam('search', input.val());
    startSearch()
  });
  form.find('.search-button').click(function (e) {
    e.preventDefault();
    startSearch();
  });

  // start query immediately if we have search text
  var search = getDefaultParam('search');
  if (search != null && search !== '') {
    input.val(search);
    setTimeout(startSearch, 100);
  }
});
