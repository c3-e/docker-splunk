/*
 * Copyright 2009-2014 C3, Inc. dba C3 Energy (http://www.c3energy.com). All Rights Reserved.
 * This material, including without limitation any software, is the confidential trade secret
 * and proprietary information of C3 Energy and its licensors. Reproduction, use and distribution
 * of this material in any form is strictly prohibited except as set forth in a written
 * license agreement with C3 Energy and/or its authorized distributors.
 */

// show only app hosts (master and workers)
var buildHostClusters = function (hosts) {
  var appTypes = [];
  ServerTypes.forEach(function (e) {
    if (e.type == 'app') {
      appTypes.push(e);
      appTypes[e.key] = e;
    }
  });
  return buildClusters(hosts, appTypes, false);
}

// actions to hide by default
var UninterestingActions = [
  { t_type: 'BatchQueue', t_action: 'dispatchCompute' },
  { t_type: 'BatchQueue', t_action: 'compute' },
  { t_type: 'MapReduceQueue', t_action: 'dispatchCompute' },
];

var QueryProps = {};
var SelectionKeys = null;

function selectActionRow(tr) {
  $('#actions-table tbody tr').removeClass('selected');
  SelectionKeys = null;

  if (tr && tr.length == 1) {
    tr.addClass('selected');

    if (QueryProps.groupFields.length > 0) {
      SelectionKeys = [];
      for (var i = 0; i < QueryProps.columns.length; i++) {
        if (QueryProps.columns[i].usage == 'profiler-group')
          SelectionKeys.push({ column: i });
      }
    } else {
      var idCol = QueryProps.getColumnByField('a_id') ||
        QueryProps.getColumnByField('a_func');
      if (idCol)
        SelectionKeys = [{ column: idCol.index }];
    }
    if (SelectionKeys) {
      for (var i = 0; i < SelectionKeys.length; i++) {
        var td = tr.find('td:nth-child(' + (SelectionKeys[i].column + 1) + ')');
        SelectionKeys[i].value = $.trim(td.text());
      }
    }
  }
}

var updatePercents = null;

function selectedActionRowUpdated(tr) {
  if (updatePercents)
    updatePercents(tr);
}

function getSelectedActionRow() {
  if (SelectionKeys == null || SelectionKeys.length < 1)
    return null;

  var table = $('#actions-table');
  var matched = null;
  table.find('tbody tr').each(function () {
    if (matched == null) {
      var tr = $(this);
      var isMatch = true;
      for (var i = 0; i < SelectionKeys.length; i++) {
        var td = tr.find('td:nth-child(' + (SelectionKeys[i].column + 1) + ')');
        var text = $.trim(td.text());
        if (text !== SelectionKeys[i].value) {
          isMatch = false;
          break;
        }
      }
      if (isMatch)
        matched = tr;
    }
  });
  return matched;
}

function startSearch() {
  var tokens = splunkjs.mvc.Components.getInstance("default");

  // basic filter
  var userSearch = $.trim($('.search-form :input[name=search]').val());
  var search = userSearch;

  // action kinds
  var kind = $('.search-form :input[name=kind]').val();
  if (kind == '*interesting*' || kind == 'interesting') {
    for (var i = 0; i < UninterestingActions.length; i++) {
      if (search != '')
        search += ' AND ';
      search += '(';
      var first = true;
      for (var k in UninterestingActions[i]) {
        if (!first)
          search += " OR ";
        search += k + '!="' + UninterestingActions[i][k] + '"';
        first = false;
      }
      search += ')';
    }
  } else if (kind && kind != '*all*') {
    if (search != '')
      search += ' AND ';
    search += kind;
  }

  // time range
  var timerange = tokens.get('earliest') + ' - ' + tokens.get('latest');
  if (!/^rt/.test(timerange)) {
    // history search; add start/end to search
    if (search != '')
      search += ' ';
    search += 'earliest="' + tokens.get('earliest') + '"';
    search += ' latest="' + tokens.get('latest') + '"';
  }

  // build final query
  QueryProps = buildQuery(search,
    $('.search-form :input[name=profiler-group]').val(),
    TimingFields,
    $('.search-form :input[name=aggregate]').val());
  QueryProps.userSearch = userSearch;
  QueryProps.timerange = timerange;
  tokens.set("action_query", QueryProps.query);
  //console.log("action_query: ", QueryProps.query);

  // timing format
  var format = $('.search-form input[name=format]').val();
  if (!format)
    format = "millis";
  formatTiming = window['formatTiming_' + format];
  if (formatTiming == null)
    formatTiming = formatTiming_millis;
  QueryProps.formatTiming = formatTiming;

  startSearchManager('Actions', QueryProps);
  clearProfile();

  return false;
}

var ProfiledInfo = null;
var ActiveProfiler = 0;

function clearProfile() {
  $('#action-profile .placeholder').show();
  $('#profile-controls .summary').hide().find('span').empty();
  $('#action-controls').hide();
  $('#action-profile table').hide();
  ProfiledInfo = null;
  ActiveProfiler = 0;
  updatePercents = null;
}

function buildCalleeTree(dataRows, idCol, parentsCol, stripSelf, queryFields, nameFields) {
  if (dataRows == null || dataRows.length < 1) {
    return {
      minDepth: 0,
      maxDepth: 0,
      tree: [],
      children: []
    };
  }

  var uniqueRows = [];
  var minDepth = NaN, maxDepth = 0;
  for (var i = 0; i < dataRows.length; i++) {
    var id = dataRows[i][idCol];
    if (id == null || id === '') {
      console.warn('buildCalleeTree: dataRows[' + i + '] is missing the ID in column ' + idCol);
      continue;
    }

    var parents = dataRows[i][parentsCol];
    if (parents == null || parents === '')
      parents = ':';
    var callers = parents ? parents.replace(stripSelf, ':') : ':';

    var key = ':' + id + parents;
    var uniqueRow = uniqueRows[key];
    if (!uniqueRow) {
      // first occurrence of this event
      uniqueRow = dataRows[i];
      uniqueRow._id = id;
      uniqueRow._order = i;
      uniqueRow._parents = parents;
      uniqueRow._callers = callers;
      uniqueRow._depth = callers.split(':').length - 1;
      uniqueRow._children = [];
      uniqueRows[key] = uniqueRow;

      if (isNaN(minDepth) || uniqueRow._depth < minDepth)
        minDepth = uniqueRow._depth;
      if (uniqueRow._depth > maxDepth)
        maxDepth = uniqueRow._depth;
    } else {
      console.error('duplicate result for key ' + key);
      // duplicate row for the event, update fields with new data
      for (var j = 0; j < queryFields.length; j++) {
        var f = queryFields[j];
        if (nameFields.indexOf(f) >= 0)
          continue;

        var v = dataRows[i][j];
        if (v != null && v !== '')
          uniqueRow[j] = v;
      }
    }
  }

  var uniqueKeys = Object.keys(uniqueRows);
  if (uniqueKeys.length < 1) {
    return {
      minDepth: 0,
      maxDepth: 0,
      tree: [],
      children: []
    };
  }

  var roots = [];
  for (var i = 0; i < uniqueKeys.length; i++) {
    var key = uniqueKeys[i];
    var row = uniqueRows[key];
    if (row._depth == minDepth) {
      roots.push(row);
    } else {
      var parent = uniqueRows[row._parents];
      if (parent)
        parent._children.push(row);
      else
        console.warn('entry ' + row._id + ': parents ' + row._parents + ' missing');
    }
  }
  roots.sort(function (a, b) {
    return a._order - b._order;
  });

  var orderedRows = [];
  var flatten = function (children) {
    for (var i = 0; i < children.length; i++) {
      orderedRows.push(children[i]);
      if (children[i]._children.length > 0)
        flatten(children[i]._children);
    }
  };
  flatten(roots);
  //console.log('uniqueKeys ' + uniqueKeys.length + ', roots ' + roots.length + ', minDepth ' + minDepth + ', maxDepth ' + maxDepth, ', children ' + orderedRows.length);

  return {
    minDepth: minDepth,
    maxDepth: maxDepth,
    tree: roots,
    children: orderedRows
  };
}

var MAX_CHILDREN = 100;

function startProfile(rowData) {
  var div = $('#action-profile');
  div.find('.placeholder').hide();
  ProfiledInfo = null;
  ActiveProfiler = 0;

  var topQuery = QueryProps;
  var selfRowInfo = topQuery.extractRowData(rowData);
  var summary = "descendents of ";
  if (selfRowInfo.a_id) {
    summary += 'action ID ' + selfRowInfo.a_id;
  } else if (selfRowInfo.count > 1) {
    summary += formatCount(selfRowInfo.count) + ' calls to';
  } else {
    summary += '1 call to';
  }
  summary += ' <b>' + ((typeof selfRowInfo.t_type == 'string') ? selfRowInfo.t_type : '*');
  summary += '.' + (selfRowInfo.t_action ? selfRowInfo.t_action : '?') + '</b>';
  $('#profile-controls .summary .profile-message').html(summary);
  $('#profile-controls .summary .search-progress').empty();

  var table = div.find('table').hide();
  table.find('tbody').remove();

  var thisProfiler = 1000000 + Math.round(Math.random() * 9000000);
  var SearchManager = require("splunkjs/mvc/searchmanager");

  var childQuery, childSearch, buildTree;
  if (selfRowInfo.a_id) {
    /*
     * We have an individual action, with a single parent;
     * generate child query using the direct relations through action IDs.
     */
    var fields = addFieldsByNames(topQuery.dataFields, 'a_pids');
    var parents = selfRowInfo.a_pids;
    if (parents == null || parents === '')
      parents = ':';
    var parentSearch = 'a_pids="*:' + selfRowInfo.a_id + parents + '"',
      childQuery = buildQuery(buildChildSearch(topQuery.finalSearch, parentSearch),
        'a_id, a_pids',
        fields,
        topQuery.agg);
    childSearch = new SearchManager({
      id: "child-search-" + thisProfiler,
      preview: true,
      cache: false,
      autostart: false,
      earliest_time: splunkjs.mvc.tokenSafe("$action_earliest$"),
      search: childQuery.query,
    });
    buildTree = function () {
      var idCol = getFieldIndexByName(childQuery.showFields, 'a_id');
      var parentCol = getFieldIndexByName(childQuery.showFields, 'a_pids');
      var stripSelf = new RegExp(':' + selfRowInfo.a_id.replace(/\./, "\\.") + ':.*$');
      return function (dataRows) {
        return buildCalleeTree(dataRows,
          idCol, parentCol,
          stripSelf,
          childQuery.showFields,
          nameFields);
      };
    }();
  } else if (selfRowInfo.a_func) {
    /*
     * We have an group of actions, with one or more parent functions;
     * generate child query using the direct relations through functions.
     */
    var fields = addFieldsByNames(topQuery.dataFields, 'a_pfuncs');
    var parents = selfRowInfo.a_pfuncs;
    if (parents == null || parents === '')
      parents = [':'];
    else if (!(parents instanceof Array))
      parents = [parents];

    var selves = selfRowInfo.a_func;
    if (!(selves instanceof Array))
      selves = [selves];

    var parentSearch;
    if (parents.length > 1 || selves.length > 1) {
      parentSearch = '(';
      for (var i = 0; i < selves.length; i++) {
        for (var j = 0; j < parents.length; j++) {
          if (i > 0 || j > 0)
            parentSearch += ' OR ';
          parentSearch += 'a_pfuncs="*:' + selves[i] + parents[j] + '"';
        }
      }
      parentSearch += ')';
    } else {
      parentSearch = 'a_pfuncs="*:' + selves[0] + parents[0] + '"';
    }
    childQuery = buildQuery(buildChildSearch(topQuery.finalSearch, parentSearch),
      'a_func, a_pfuncs',
      fields,
      topQuery.agg);
    childSearch = new SearchManager({
      id: "child-search-" + thisProfiler,
      preview: true,
      cache: false,
      autostart: false,
      earliest_time: splunkjs.mvc.tokenSafe("$action_earliest$"),
      search: childQuery.query,
    });
    buildTree = function () {
      var idCol = getFieldIndexByName(childQuery.showFields, 'a_func');
      var parentCol = getFieldIndexByName(childQuery.showFields, 'a_pfuncs');
      var stripSelf;
      if (selfRowInfo.a_func instanceof Array) {
        var expr = '(';
        for (var i = 0; i < selfRowInfo.a_func.length; i++) {
          if (i > 0)
            expr += '|';
          expr += selfRowInfo.a_func[i].replace(/\./, "\\.");
        }
        expr += ')';
        stripSelf = new RegExp(':' + expr + ':.*$');
      } else {
        stripSelf = new RegExp(':' + selfRowInfo.a_func.replace(/\./, "\\.") + ':.*$');
      }
      return function (dataRows) {
        return buildCalleeTree(dataRows,
          idCol, parentCol,
          stripSelf,
          childQuery.showFields,
          nameFields);
      };
    }();
  }
  if (childSearch) {
    // remember user search criteria
    childQuery.userSearch = buildChildSearch(topQuery.userSearch, '');

    // fire up the spinner
    $('#profile-controls .shared-jobstatus-spinner').remove();
    var WaitSpinner = require("views/shared/WaitSpinner");
    childSearch.spinner = new WaitSpinner({ className: 'pull-left shared-jobstatus-spinner' });
    $('#profile-controls .summary').prepend(childSearch.spinner.$el);
    childSearch.spinner.$el.show();
    childSearch.spinner.start();

    // initialize the other member of the status
    $('#profile-controls .summary .search-progress').html('<span><i class="icon-clock"></i> starting</span>');
    $('#profile-controls .summary .search-count').html("0");

    // get the fields needed for building the callee table
    var nameFields = getFieldsByNames('t_type', 't_action');
    var toolTip = 'Action Name: ';
    for (var i = 0; i < nameFields.length; i++) {
      if (i > 0)
        toolTip += ', ';
      toolTip += nameFields[i].field;
    }
    var headRow = table.find('thead').empty().append($('<tr><th title="' + toolTip + '" class="name">Callee</th></tr>')).find('tr');
    var parentSumCol = topQuery.getColumnByExpr('sum(a_t)');
    var timingFieldCount = 0;
    for (var i = 0; i < childQuery.columns.length; i++) {
      var f = childQuery.columns[i].field;
      if (f.isGroup('hidden'))
        continue;

      if (nameFields.indexOf(f) < 0) {
        // add percentage just before timings
        if (parentSumCol != null &&
          f.type == 'timing' &&
          timingFieldCount < 1)
          headRow.append('<th class="percent numeric" title="Total time percent of selected action">%</th>');

        var th = $('<th title="' + formatToolTip(childQuery.columns[i]) + '">' + childQuery.columns[i].label + '</th>');
        if (f.type == 'count' || f.type == 'timing')
          th.addClass('numeric');
        headRow.append(th);

        if (f.type == 'timing')
          timingFieldCount++;
      }
    }

    // update query status
    var running = true;
    var updateStatus = function (status, properties) {
      if (ActiveProfiler != thisProfiler) {
        if (status == 'progress')
          childSearch.cancel();
        return;
      }
      var eventCount = 0;
      if (properties && properties.content && properties.content.eventCount > 0)
        eventCount = properties.content.eventCount;

      var icon = null;
      if (status == 'done') {
        icon = 'check';
        running = false;
      } else if (status == 'starting' || status == 'start') {
        icon = 'clock';
        running = true;
      } else if (status == 'progress') {
        icon = 'clock';
        running = true;
        status = 'running';
      } else {
        icon = 'alert';
        running = false;
      }
      //console.log('status: ' + status + ', icon: ' + icon + ', running: ' + running);
      var progress = '';
      if (icon)
        progress += '<i class="icon-' + icon + '"></i> ';
      if (icon || running)
        progress += status;
      if (eventCount > 0) {
        if (progress != '')
          progress += ', ';
        progress += formatCount(eventCount) + '&nbsp;events';
      }
      $('#profile-controls .summary .search-progress').html(progress);

      if (!running && eventCount < 1) {
        setTimeout(function () {
          if (childSearch.spinner != null)
            childSearch.spinner.stop();
          $('#profile-controls .shared-jobstatus-spinner').hide();
        }, 10);
      }
    }
    childSearch.on('search:error', function (properties) {
      console.error("child search error:", properties);
      updateStatus('error', properties);
    });
    childSearch.on('search:failed', function (properties) {
      console.error("child search failed:", properties);
      updateStatus('failed', properties);
    });
    childSearch.on('search:progress', function (properties) {
      updateStatus('progress', properties);
    });
    childSearch.on('search:done', function (properties) {
      updateStatus('done', properties);
    });

    // update result rows
    var updateResults = function (dataSet, type) {
      table.find('tbody').remove();
      var tree = buildTree(dataSet.data().rows);
      var rows = tree.children;
      //console.log('childSearch ' + type + ': got ' + rows.length + ' unique rows from results');
      $('#profile-controls .summary .search-count').html(formatCount(rows.length));

      var tbody = null;
      var childCount = 0;
      for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        var hasChild = rows.length > i + 1 && rows[i + 1]._depth > row._depth;
        var columnCount = 0;

        if (row._depth <= 1 && tbody) {
          table.append(tbody);
          tbody = null;
        }
        if (!tbody) {
          if (childCount >= MAX_CHILDREN)
            break;

          childCount++;
          tbody = $('<tbody data-key="' + row._id + '"></tbody>');
        }

        var tr = $('<tr class="' + (row._depth > 1 ? 'descendent' : 'child') + '" data-key="' + row._id + '"></tr>');
        var nameCol = $('<td class="name">'
          + '<div class="icon-flip-y"><i class="icon-share"></i></div>&nbsp;</td>');
        tr.append(nameCol);
        columnCount++;
        if (row._depth > 1) {
          var indent = '';
          for (var j = 1; j < row._depth; j++)
            indent += '<span class="indent"></span>';
          nameCol.prepend(indent);
        }

        var nameParts = [];
        var timingFieldCount = 0;
        var childSumIndex = -1;
        for (var j = 0; j < childQuery.columns.length; j++) {
          var col = childQuery.columns[j];
          if (col.field.isGroup('hidden'))
            continue;

          var v = rows[i][col.index];
          var ni = nameFields.indexOf(col.field);
          if (ni >= 0) {
            nameParts[ni] = v ? v : '*';
          } else {
            // insert the percent column before the first timing
            if (parentSumCol != null &&
              col.field.type == 'timing' &&
              timingFieldCount < 1) {
              tr.append('<td class="percent numeric"></td>');
              columnCount++;
            }

            // locate the child total time column
            if (col.expr == 'a_t' || col.expr == 'sum(a_t)')
              childSumIndex = columnCount;

            // add this field
            var td = $('<td data-value="' + v + '"></td>');
            formatField(td, col.field, v);
            tr.append(td);
            columnCount++;

            if (col.field.type == 'timing')
              timingFieldCount++;
          }
        }
        var name = nameParts.join('.');
        if (row._depth <= 1 && hasChild)
          nameCol.append($('<a href="#"><i class="icon-expand-right"></i> ' + name + '</a>'));
        else
          nameCol.append(name);
        tbody.append(tr);
      }
      if (tbody)
        table.append(tbody);

      updatePercents = null;
      if (parentSumCol != null && childSumIndex >= 0) {
        updatePercents = function (tr) {
          updateCalleePercents(tr, parentSumCol.index, childSumIndex);
        };
        updatePercents(getSelectedActionRow());
      }

      table.find('td.name a').click(function (e) {
        e.preventDefault();
        var childRows = $(this).closest('tbody').find('tr.descendent');
        if (childRows.is(':visible')) {
          $(this).find('i').removeClass('icon-collapse-left').addClass('icon-expand-right');
          childRows.hide();
        } else {
          $(this).find('i').removeClass('icon-expand-right').addClass('icon-collapse-left');
          childRows.show();
        }
      });
    }
    var previewDataSet = childSearch.data('preview', { count: MAX_CHILDREN * 1000, offset: 0 });
    previewDataSet.on('data', function (dataSet) {
      updateResults(dataSet, 'preview');

      if (!running) {
        setTimeout(function () {
          if (childSearch.spinner != null)
            childSearch.spinner.stop();
          $('#profile-controls .shared-jobstatus-spinner').hide();
        }, 10);
      }
    });

    var group = $('#profile-controls .summary .btn-group');
    group.find('a').unbind();
    $('#profile-controls .summary').show();
    group.find('a.query').click(function (e) {
      e.preventDefault();
      queryDialog(childQuery, 'Callees');
    });
    group.find('a.export').click(function (e) {
      e.preventDefault();
      exportTableCSV($('#action-profile table'), null, 'callees.csv');
    });

    table.show();
    ProfiledInfo = selfRowInfo;
    ActiveProfiler = thisProfiler;
    childSearch.startSearch();
  }
}

function updateCalleePercents(parentRow, parentSumCol, childSumCol) {
  var parentTime = null;
  if (parentRow != null && parentRow.length == 1 && parentSumCol >= 0) {
    var parentSumCell = parentRow.find('td:nth-child(' + (parentSumCol + 1) + ')');
    if (parentSumCell && parentSumCell.length == 1)
      parentTime = parseFloat(parentSumCell.data('value'));
  }
  if (parentTime == null || isNaN(parentTime)) {
    $('#profile-table tbody td.percent').html('&mdash;');
    return;
  }

  $('#profile-table tbody tr').each(function () {
    var childRow = $(this);
    var childTime = null;
    var childSumCell = childRow.find('td:nth-child(' + (childSumCol + 1) + ')');
    if (childSumCell.length == 1)
      childTime = parseFloat(childSumCell.data('value'));
    var childPct = null;
    if (childTime != null) {
      if (childTime <= 1e-9)
        childPct = 0;
      else if (parentTime <= childTime)
        childPct = 100;
      else
        childPct = (childTime / parentTime) * 100;
    }

    var childPctCell = childRow.find('td.percent');
    if (childPct == null)
      childPctCell.html('&mdash;');
    else {
      childPctCell.empty().text(roundToString(childPct, 2));
    }
  });
}

function formatField(td, field, value) {
  if (field.type == 'count' || field.type == 'timing')
    td.addClass('numeric');
  else
    td.removeClass('numeric');

  if (value == null || value === '')
    td.text('');
  else if (field.type == 'count')
    td.text(formatCount(value));
  else if (field.type == 'timing')
    td.text(formatTiming(value));
  else
    td.text(formatValues(value));
}

require([
  "splunkjs/ready!",
  "splunkjs/mvc/simplexml/ready!",
  "splunkjs/mvc/tableview",
  "splunkjs/mvc/timerangeview",
  "splunkjs/mvc/searchcontrolsview",
  "views/shared/appbar/Master",
  "views/shared/WaitSpinner",
], function (mvc) {

  // hook clicks in the action table to trigger tree details
  var actionsTable = splunkjs.mvc.Components.getInstance('actions-table');
  actionsTable.on('click', function (e) {
    e.preventDefault();
    selectActionRow($('#actions-table tbody tr:nth-child(' + (e.event.rowIndex + 1) + ')'));
    startProfile(e.data);
  });
  customizeTable(actionsTable);
  actionsTable.table.bind('rendered', function () {
    var table = $('#actions-table table');
    if (table.is(':visible')) {
      var tr = getSelectedActionRow();
      if (tr != null) {
        tr.addClass('selected');
        selectedActionRowUpdated(tr);
      }
    }
  });

  // using Splunk timerange view
  var timeRange = mvc.Components.getInstance('actions-timerange');
  timeRange.on('change', function (e) {
    var tokens = mvc.Components.getInstance("default");
    var value = tokens.get('earliest') + ' - ' + tokens.get('latest');
    if (searchParamChanged != null)
      searchParamChanged('profiler-timerange', value);
    setDefaultParam('profiler-timerange', value);
    startSearch();
  });

  // let Splunk finish initializing
  setTimeout(function () {
    // change the message in the search results, after a short delay
    $('#actions-table .msg .alert-info').empty().append($('<i class="icon-alert"></i>'));
    $('#actions-table .alert-info').append('Search for actions using the bar above.');
  }, 10);
});
