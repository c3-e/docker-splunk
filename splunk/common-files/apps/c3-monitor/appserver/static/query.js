/*
 * Copyright 2009-2014 C3, Inc. dba C3 Energy (http://www.c3energy.com). All Rights Reserved.
 * This material, including without limitation any software, is the confidential trade secret
 * and proprietary information of C3 Energy and its licensors. Reproduction, use and distribution
 * of this material in any form is strictly prohibited except as set forth in a written
 * license agreement with C3 Energy and/or its authorized distributors.
 */

function parseTimeRange(input) {
  if (input == null || input === '')
    return [];

  var range = [];

  var parts = input.split(/ +- +/, 2);

  var p = $.trim(parts[0]);
  range[0] = (p === '') ? null : p;

  p = $.trim(parts[1]);
  range[1] = (p === '') ? null : p;

  return range;
}

function makeStableTime(input, from, format) {
  if (format == null || format === '')
    format = 'X.SSS';
  if (from == null)
    from = new Date();

  if (input == null || (input = $.trim(input)) === '' || input == 'now' || input == 'rt')
    return moment(from).format(format);

  if (/^[1-9][0-9]*(\.[0-9]+)?$/.test(input))
    return moment.unix(input).format(format);

  var match = input.match(/^-(\d+)([dhms])/) ||
    input.match(/^last_(\d+)_([dhms])/) ||
    input.match(/^rt-(\d+)([dhms])/);
  if (match && match.length == 3) {
    var adjusted = moment(from).add(match[2], -parseInt(match[1]));
    return adjusted.format(format);
  }

  var parsed = moment(input);
  if (!parsed.isValid())
    return null;
  return parsed.format(format);
}

function queryDialog(queryProps, type, form) {
  var dialog = $('#query-dialog');
  if (type != null)
    dialog.find('.modal-title .which').text(type);
  else
    dialog.find('.modal-title .which').text('Current');

  dialog.find('textarea[name=user]').val(queryProps.userSearch);

  var formatted = queryProps.finalSearch.replace(/ +earliest=/, '\nearliest=');
  dialog.find('textarea[name=final]').val(formatted);

  dialog.find('.links a').unbind();
  if (form && form.length == 1) {
    dialog.find('.links').show();
    dialog.find('.links a').each(function (i) {
      var link = $(this);
      var url = makeQueryURL(queryProps, link);
      $(this).click(function (e) {
        e.preventDefault();
        shareQueryURL(url, link);
      });
    });
  } else {
    dialog.find('.links').hide();
  }

  formatted = queryProps.query.replace(/ +\| */g, "\n| ");
  dialog.find('textarea[name=splunk]').val(formatted);

  dialog.modal('show');
}

function makeQueryURL(queryProps, caller) {
  var stable = false;
  if (caller && caller.hasClass('stable'))
    stable = true;

  var form = $('form.search-form');
  var query;
  if (stable) {
    var range = parseTimeRange(queryProps.timerange);
    var value = makeStableTime(range[0], queryProps.created) +
      ' - ' +
      makeStableTime(range[1], queryProps.created);
    query = 'timerange=' + encodeURIComponent(value);

    var params = form.serializeArray();
    for (var i = 0; i < params.length; i++) {
      if (params[i].name == 'timerange')
        continue;

      query += '&' + params[i].name + '=' + encodeURIComponent(params[i].value);
    }
  } else {
    query = form.serialize();
  }
  return window.location.origin + window.location.pathname + '?' + query;
}

function shareQueryURL(queryProps, caller) {
  var url;
  if (typeof queryProps === 'string')
    url = queryProps;
  else
    url = makeQueryURL(queryProps, caller);
  if (url == null)
    return false;

  var what = 'copy';
  if (caller && caller.hasClass('new-tab'))
    what = 'new-tab';

  switch (what) {
    case 'link':
    case 'new-tab':
      $('<a>', {
        href: url,
        target: '_blank',
      }).get(0).click();
      return true;

    case 'copy':
      prompt('Action Profiler URL:', url);
      return true;

    default:
      return false;
  }
}

function startSearchManager(name, queryProps) {

  var idPart = name.toLowerCase().replace(/\s+/g, '');

  var searchManager = splunkjs.mvc.Components.getInstance('search-' + idPart);
  searchManager.on('search:progress', function (p) {
    // console.log("Search in progress with properties: " + JSON.stringify(p));
  });
  searchManager.on('search:done', function (p) {
    // console.log("Search in progress with properties: " + JSON.stringify(p));
  });
  searchManager.startSearch();

  setTimeout(function () {
    return function () {
      // add extra controls to search mode
      var controls = $('#' + idPart + '-controls');
      var group = controls.find('.jobstatus-profiler');
      if (group.length < 1) {
        var mode = controls.find('div.shared-jobstatus-searchmode');
        mode.after('<div class="btn-group pull-right jobstatus-profiler">&nbsp;'
          + '<a class="btn btn-small query" title="show query details" href="#"><i class="icon-search"></i> Query</a>'
          + '<a class="btn btn-small copy stable" title="copy stable time range URL" href="#"><i class="icon-clipboard"></i> Stable</a>'
          + '<a class="btn btn-small export" title="export visible rows as CSV" href="#"><i class="icon-report"></i> Export</a>'
          + '</div>');
        group = controls.find('.jobstatus-profiler');
      } else {
        group.find('a').unbind();
      }

      group.find('a.query').click(function (e) {
        e.preventDefault();
        queryDialog(queryProps, name, $('.search-form'));
      });
      group.find('a.copy').click(function (e) {
        e.preventDefault();
        shareQueryURL(queryProps, $(this));
      });
      group.find('a.export').click(function (e) {
        e.preventDefault();
        exportTableCSV($('#' + idPart + '-table table'), null, idPart + '.csv');
      });
    };
  }(), 10);
}

function queryAccessors(props) {
  props.extractRowData = function (rowData) {
    var obj = {};
    for (var i = 0; i < this.showFields.length; i++) {
      var f = this.showFields[i];
      obj[f.field] = rowData['row.' + f.field] || rowData['row.' + f.label];
    }
    for (var i = 0; i < this.columns.length; i++) {
      var f = this.columns[i].field;
      if (!obj[f.field])
        obj[f.field] = rowData['row.' + this.columns[i].label];
    }
    return obj;
  }
  props.getFieldByName = function (name) {
    for (var i = 0; i < this.showFields.length; i++) {
      var f = this.showFields[i];
      if (f.field == name || f.label == name)
        return field;
    }
    for (var i = 0; i < this.columns.length; i++) {
      if (this.columns[i].label == name)
        return this.columns[i].field;
    }
    return null;
  }
  props.getColumnByField = function (f) {
    if (typeof f === 'string') {
      for (var i = 0; i < this.columns.length; i++) {
        if (this.columns[i].field.field == f)
          return this.columns[i];
      }
    } else {
      for (var i = 0; i < this.columns.length; i++) {
        if (this.columns[i].field == f)
          return this.columns[i];
      }
    }
    return null;
  }
  props.getColumnByName = function (name) {
    for (var i = 0; i < this.columns.length; i++) {
      if (this.columns[i].field.field == name ||
        this.columns[i].field.label == name ||
        this.columns[i].label == name)
        return this.columns[i];
    }
    return null;
  }
  props.getColumnByExpr = function (expr) {
    for (var i = 0; i < this.columns.length; i++) {
      if (this.columns[i].expr == expr)
        return this.columns[i];
    }
    if (/^sum\(/.test(expr)) {
      // sum(x) is equivalent to x, when not grouping
      var bare = expr.replace(/^sum\(([^)]+)\)$/, "$1");
      if (bare != expr)
        return this.getColumnByExpr(bare);
    }
    return null;
  }

  return props;
}

function buildChildSearch(actionSearch, parentSearch) {

  // extract selected filters from the action query
  var pieces = {};
  var earliest = '', latest = '';
  if (actionSearch != null && actionSearch !== '') {
    var whitelist = ['host', 'a_rid', 'earliest', 'latest'];
    for (var i = 0; i < whitelist.length; i++) {
      var param = whitelist[i];
      var res = [new RegExp('\\b(' + param + '="[^"]*")', 'g'),
        new RegExp('\\b(' + param + '=[^"\\s][^\\s)]*)', 'g')];
      res.forEach(function (re, i) {
        var match;
        while (match = re.exec(actionSearch)) {
          var piece = match[1];
          if (param == 'earliest') {
            earliest = piece;
          } else if (param == 'latest') {
            latest = piece;
          } else {
            var a = pieces[param];
            if (a == null)
              pieces[param] = a = [];
            a.push(piece);
          }
        }
      });
    }
  }

  // build the combined search
  var combined = '';
  Object.keys(pieces).forEach(function (k, i) {
    if (combined != '')
      combined += ' AND ';

    var a = pieces[k];
    if (a.length > 1) {
      combined += '(';
      for (var i = 0; i < a.length; i++) {
        if (i > 0)
          combined += ' OR ';
        combined += a[i];
      }
      combined += ')';
    } else {
      combined += a[0];
    }
  });

  // add parent search criteria
  if (parentSearch) {
    if (combined !== '')
      combined += ' AND ';
    combined += parentSearch;
  }

  // add earliest and latest last
  if (earliest) {
    if (combined !== '')
      combined += ' ';
    combined += earliest;
  }
  if (latest) {
    if (combined !== '')
      combined += ' ';
    combined += latest;
  }

  return combined;
}

function spanLengthSeconds(span) {
  var match = /^(\d+)s.*$/.exec(span);
  if (match)
    return parseInt(match[1]);

  match = /^(\d+)m.*$/.exec(span);
  if (match)
    return parseInt(match[1]) * 60;

  match = /^(\d+)h.*$/.exec(span);
  if (match)
    return parseInt(match[1]) * 60 * 60;

  match = /^(\d+)d.*$/.exec(span);
  if (match)
    return parseInt(match[1]) * 60 * 60 * 24;

  return null;
}

function spanForTimeRange(timerange, smallest, max) {
  var Spans = ['5s', '10s', '15s', '30s', '1m', '5m', '10m', '30m', '1h', '4h', '12h', '1d', '5d'];

  if (smallest == null || smallest === '')
    smallest = Spans[0];

  if (max == null)
    max = 1000;
  if (!(max > 0))
    return smallest;

  if (!(timerange instanceof Array))
    timerange = parseTimeRange(timerange);
  if (timerange == null || timerange.length != 2)
    return smallest;

  var earliest = makeStableTime(timerange[0]),
    latest = makeStableTime(timerange[1]);
  if (earliest == null || latest == null)
    return smallest;
  var timerangeLength = Math.ceil(parseFloat(latest)) - Math.floor(parseFloat(earliest));

  // try the span we were given
  var smallestLength = spanLengthSeconds(smallest);
  if (timerangeLength / smallestLength < max)
    return smallest;

  // search through the standard spans
  for (var i = 0; i < Spans.length; i++) {
    var length = spanLengthSeconds(Spans[i]);
    if (timerangeLength / length < max)
      return Spans[i];
  }

  // return the longest span we have
  return Spans[Spans.length - 1];
}
