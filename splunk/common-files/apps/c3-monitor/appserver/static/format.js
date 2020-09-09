/*
 * Copyright 2009-2014 C3, Inc. dba C3 Energy (http://www.c3energy.com). All Rights Reserved.
 * This material, including without limitation any software, is the confidential trade secret
 * and proprietary information of C3 Energy and its licensors. Reproduction, use and distribution
 * of this material in any form is strictly prohibited except as set forth in a written
 * license agreement with C3 Energy and/or its authorized distributors.
 */

var formatTiming = formatTiming_seconds_millis;

function zeroPad(value, width) {
  var minus = "";
  if (value == null || value === '')
    value = "0";
  else if (value < 0) {
    minus = "-";
    value = roundToString(Math.abs(value));
  } else
    value = roundToString(value);
  if (!(width > 0))
    return value;

  var format = value;
  while (format.length < width)
    format = "0" + format;
  return minus + format;
}

function roundToString(value, digits) {
  if (typeof value !== 'number')
    value = parseFloat(value);
  if (isNaN(value))
    value = 0;

  if (digits == null || !(digits > 0))
    digits = 0;
  return value.toFixed(digits);
}

function formatTiming_millis(secs) {
  if (secs == null || secs === '' || secs < 0)
    return "0";
  else
    return formatCount(secs * 1000);
}

function formatTiming_seconds(secs) {
  if (secs == null || secs === '' || secs < 0)
    return "0";
  else
    return formatCount(secs);
}

function formatTiming_seconds_millis(secs) {
  if (secs == null || secs === '' || secs < 0)
    return "0.000";

  var ms = Math.round(secs * 1000) % 1000;
  var s = Math.floor(secs);
  return formatCount(s) + '.' + zeroPad(ms, 3);
}

function formatTiming_time(secs) {
  if (secs == null || secs === '' || secs < 0)
    secs = 0;
  var s = Math.round(secs);
  var m = Math.floor(secs / 60);
  var h = Math.floor(m / 60);
  if (h > 0)
    return '' + roundToString(h) + 'h' + zeroPad(m % 60, 2) + 'm' + zeroPad(s % 60, 2) + 's';
  else if (m > 0)
    return '' + roundToString(m) + 'm' + zeroPad(s % 60, 2) + 's';
  else
    return '' + roundToString(s) + 's';
}

function formatTiming_time_millis(secs) {
  if (secs == null || secs === '' || secs < 0)
    secs = 0;
  var ms = Math.round(secs * 1000) % 1000;
  var s = Math.floor(secs);
  var m = Math.floor(secs / 60);
  var h = Math.floor(m / 60);
  if (h > 0)
    return '' + roundToString(h) + 'h' + zeroPad(m % 60, 2) + 'm' + zeroPad(s % 60, 2) + '.' + zeroPad(ms, 3) + 's';
  else if (m > 0)
    return '' + roundToString(m) + 'm' + zeroPad(s % 60, 2) + '.' + zeroPad(ms, 3) + 's';
  else
    return '' + roundToString(s) + '.' + zeroPad(ms, 3) + 's';
}

function formatCount(n) {
  return roundToString(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function formatValues(v) {
  if (v == null || v === '')
    return '';
  if (v instanceof Array) {
    if (v.length < 1)
      return '';

    var s = formatValues(v[0]);
    if (v.length > 1)
      s += ' +' + formatCount(v.length - 1);
    return s;
  } else {
    return v;
  }
}
