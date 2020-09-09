/*
 * Copyright 2009-2014 C3, Inc. dba C3 Energy (http://www.c3energy.com). All Rights Reserved.
 * This material, including without limitation any software, is the confidential trade secret
 * and proprietary information of C3 Energy and its licensors. Reproduction, use and distribution
 * of this material in any form is strictly prohibited except as set forth in a written
 * license agreement with C3 Energy and/or its authorized distributors.
 */

var AggAbbrevs = [
  {
    agg: ['sum'],
    abbrev: 'Σ'
  },
  {
    agg: ['mean', 'avg', 'average'],
    abbrev: 'μ'
  },
  {
    agg: ['min', 'minimum'],
    abbrev: '∧'
  },
  {
    agg: ['max', 'maximum'],
    abbrev: '∨'
  },
  {
    agg: ['median', 'p50'],
    abbrev: 'M'
  },
  {
    agg: ['p25'],
    abbrev: 'Q₁'
  },
  {
    agg: ['p75'],
    abbrev: 'Q₃'
  },
  {
    agg: ['p90'],
    abbrev: 'p₉₀'
  },
  {
    agg: ['p95'],
    abbrev: 'p₉₅'
  },
];

function getAggAbbrev(agg) {
  if (agg == null || agg === '')
    return '';

  for (var i = 0; i < AggAbbrevs.length; i++) {
    if (AggAbbrevs[i].agg.indexOf(agg) >= 0)
      return AggAbbrevs[i].abbrev;
  }
  return agg;
}

function getFieldByName(name) {
  var m = /^[a-z][a-z0-9]*[(]([^)]+)[)]$/.exec(name);
  if (m)
    name = m[1];
  for (var i = 0; i < AllFields.length; i++) {
    if (AllFields[i].field == name)
      return AllFields[i];
  }
  return null;
}

function getFieldsByNames() {
  var names = arguments;
  if (arguments.length == 1 && arguments[0] instanceof Array)
    names = arguments[0];

  var fields = [];
  for (var i = 0; i < names.length; i++) {
    var f = getFieldByName(names[i]);
    if (f)
      fields.push(f);
  }
  return fields;
}

function addFieldsByNames() {
  var fields = arguments[0] ? arguments[0].slice(0) : [];
  for (var i = 1; i < arguments.length; i++) {
    var f = getFieldByName(arguments[i]);
    if (f)
      fields.push(f);
  }
  return fields;
}

function getFieldIndexByName(fields, name) {
  for (var i = 0; i < fields.length; i++) {
    if (fields[i].field == name)
      return i;
  }
  return -1;
}

function getFieldByLabel(label) {
  for (var i = 0; i < AllFields.length; i++) {
    if (AllFields[i].field == label || AllFields[i].label == label)
      return AllFields[i];
  }
  return null;
}

function getFieldsByLabels() {
  var fields = [];
  for (var i = 0; i < arguments.length; i++) {
    var f = getFieldByLabel(arguments[i]);
    if (f)
      fields.push(f);
  }
  return fields;
}

function getFieldLabel(field) {
  var i;
  for (i = 0; i < AllFields.length; i++) {
    if (AllFields[i].field == field)
      return AllFields[i].label;
  }
  return field;
}
