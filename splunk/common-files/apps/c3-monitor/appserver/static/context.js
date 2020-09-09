/*
 * Copyright 2009-2014 C3, Inc. dba C3 Energy (http://www.c3energy.com). All Rights Reserved.
 * This material, including without limitation any software, is the confidential trade secret
 * and proprietary information of C3 Energy and its licensors. Reproduction, use and distribution
 * of this material in any form is strictly prohibited except as set forth in a written
 * license agreement with C3 Energy and/or its authorized distributors.
 */

var urlParams = null;
var cookiePrefix = 'c3monitor_';

function getDefaultParam(param) {
  // load URL parameters one
  if (urlParams == null) {
    urlParams = {};
    if (/\?./.test(window.location.search)) {
      var params = window.location.search.substring(1).split(/&+/);
      for (var i = 0; i < params.length; i++) {
        var parts = params[i].split('=', 2);
        var name = parts[0], value = '';
        if (parts.length > 1)
          value = decodeURIComponent(parts[1]).replace(/\+/g, ' ');
        urlParams[name] = value;
      }
    }
  }

  // see if we have a URL parameter
  if (urlParams[param] != null)
    return urlParams[param];

  // fall back to the cookie
  return $.cookie(cookiePrefix + param);
}

function setDefaultParam(param, value) {
  $.cookie(cookiePrefix + param, value);
}
