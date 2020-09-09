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

var QueryProps = {};
var SelectionKeys = null;

function selectHostsRow(tr) {
  $('#actions-table tbody tr').removeClass('selected');
  SelectionKeys = null;

  if (tr && tr.length == 1) {
    tr.addClass('selected');

    if (QueryProps.groupFields.length > 0) {
      SelectionKeys = [];
      for (var i = 0; i < QueryProps.columns.length; i++) {
        if (QueryProps.columns[i].usage == 'throughput-group')
          SelectionKeys.push({ column: i });
      }
    } else {
      var hostCol = QueryProps.getColumnByField('host');
      if (hostCol)
        SelectionKeys = [{ column: hostCol.index }];
    }
    if (SelectionKeys) {
      for (var i = 0; i < SelectionKeys.length; i++) {
        var td = tr.find('td:nth-child(' + (SelectionKeys[i].column + 1) + ')');
        SelectionKeys[i].value = $.trim(td.text());
      }
    }
  }
}

function getSelectedHostsRow() {
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

  // time range
  var timerange = tokens.get('earliest') + ' - ' + tokens.get('latest');
  if (!/^rt/.test(timerange)) {
    // history search; add start/end to search
    if (search != '')
      search += ' ';
    search += 'earliest="' + tokens.get('earliest') + '"';
    search += ' latest="' + tokens.get('latest') + '"';
  }

  // choose span based on length of time range
  var span = spanForTimeRange(timerange, '5s', 500);

  // choose fields based on selected statistic(s)
  var groups = $.trim($('.search-form :input[name=statistic]').val()).split(/[ ,]+/);
  if (groups == null || groups.length < 1)
    groups = ['total'];
  else {
    for (var j = 0; j < groups.length; j++)
      groups[j] = $.trim(groups[j]).toLowerCase();
  }

  // always add primary fields
  var fields = [];
  for (var i = 0; i < StatsFields.length; i++) {
    if (StatsFields[i].isPrimary())
      fields.push(StatsFields[i]);
  }

  // then add the fields for selected statistic groups
  for (var i = 0; i < StatsFields.length; i++) {
    for (var j = 0; j < groups.length; j++) {
      if (!StatsFields[i].isPrimary() && StatsFields[i].isGroup(groups[j]))
        fields.push(StatsFields[i]);
    }
  }

  // get the layout style
  var chartHeight = parseInt($.trim($('.search-form :input[name=layout]').val()));
  if (isNaN(chartHeight) || chartHeight < 100)
    chartHeight = 100;
  if (chartHeight <= 200) {
    $('.chart-title').hide();
    $('.chart-controls').hide();
  } else {
    $('.chart-title').show();
    $('.chart-controls').show();
  }
  tokens.set("chart_height", '' + chartHeight + 'px');

  // build final query
  QueryProps = buildQuery(search,
    $('.search-form :input[name=throughput-group]').val(),
    fields,
    span,
    false);
  QueryProps.userSearch = userSearch;
  QueryProps.timerange = timerange;
  QueryProps.statGroups = groups;
  tokens.set("hoststats_query", QueryProps.query);
  //console.log("hoststats_query: ", QueryProps.query);

  // timing format
  var format = $('.search-form input[name=format]').val();
  if (!format)
    format = "millis";
  formatTiming = window['formatTiming_' + format];
  if (formatTiming == null)
    formatTiming = formatTiming_millis;
  QueryProps.formatTiming = formatTiming;

  startSearchManager('Host Stats', QueryProps);
  updateCharts(null);
}

var ChartedInfo = null;
var ActiveChart = 0;

function updateCharts(rowData) {

  // get the height for the charts
  var chartHeight = parseInt($.trim($('.search-form :input[name=layout]').val()).split(/[ ,]+/));
  if (isNaN(chartHeight) || chartHeight <= 0)
    chartHeight = null;

  // generate the base part of the child queries
  var topQuery = QueryProps;
  var parentSearch = '', parentName = '';
  if (rowData != null) {
    var selfRowInfo = topQuery.extractRowData(rowData);
    for (var i = 0; i < topQuery.groupFields.length; i++) {
      var field = topQuery.groupFields[i];
      var value = selfRowInfo[field.field];
      if (value == null || value === '')
        continue;

      if (parentSearch != '')
        parentSearch += ' AND ';
      if (field.field == 'cluster') {
        parentSearch += 'host="' + value + '-*"';
      } else if (field.field == 'role') {
        if (value == 'm' || value == 'master')
          value = 'app-m';
        if (value == 'w' || value == 'worker')
          value = 'app-w';
        parentSearch += 'host="*-' + value + '-*"';
      } else {
        parentSearch += field.field + '="' + value + '"';
      }

      if (parentName != '')
        parentName += ', ';
      parentName += field.label + ' ' + value;
    }
  } else {
    parentName = 'All Hosts';
  }

  // set up each chart
  var thisChart = 1000000 + Math.round(Math.random() * 9000000);
  ['timing', 'count', 'sqlcluster'].forEach(function (chartName) {
    var fields = [], statGroup, rate;
    if (/timing/.test(chartName)) {
      statGroup = 'total';
      if (topQuery.statGroups != null && topQuery.statGroups.length > 0)
        statGroup = topQuery.statGroups[0];
      for (var i = 0; i < StatsFields.length; i++) {
        var field = StatsFields[i];
        if (field.isTiming() && !/^a_/.test(field.field) && field.isGroup(statGroup))
          fields.push(field);
      }
      rate = true;
    } else if (/count/.test(chartName)) {
      for (var i = 0; i < StatsFields.length; i++) {
        var field = StatsFields[i];
        if (field.isCount() && field.isGroup('actions') && field.isPrimary())
          fields.push(field);
      }
      rate = true;
    } else if (/sqlcluster/.test(chartName)) {
      for (var i = 0; i < StatsFields.length; i++) {
        var field = StatsFields[i];
        if (field.isGroup('cluster'))
          fields.push(field);
      }
      rate = false;
    }
    if (fields.length < 1)
      console.error('no fields chosen for chart ' + chartName);
    var childQuery = buildQuery(buildChildSearch(topQuery.finalSearch, parentSearch),
      null,
      fields,
      topQuery.span,
      rate);
    childQuery.userSearch = buildChildSearch(topQuery.userSearch, '');

    // adjust the query in the single search manager
    var searchManager = splunkjs.mvc.Components.getInstance('chart-' + chartName + 'stats');
    //searchManager.stop();
    var tokens = splunkjs.mvc.Components.getInstance("default");
    tokens.set(chartName + "stats_chart", childQuery.query);

    // fire up the spinner
    var controls = $('#' + chartName + 'chart-controls');
    controls.find('.shared-jobstatus-spinner').remove();
    var WaitSpinner = require("views/shared/WaitSpinner");
    if (searchManager.spinner == null)
      searchManager.spinner = new WaitSpinner({ className: 'pull-left shared-jobstatus-spinner' });
    controls.find('.summary').prepend(searchManager.spinner.$el);
    searchManager.spinner.$el.show();
    searchManager.spinner.start();
    controls.find('.summary .search-parent').html(parentName);
    controls.find('.summary .search-progress').html('<span><i class="icon-clock"></i> starting</span>');

    // update query status
    var running = true;
    var updateStatus = function (status, properties) {
      if (ActiveChart != thisChart) {
        if (status == 'progress')
          searchManager.cancel();
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
      controls.find('.summary .search-progress').html(progress);

      if (!running) {
        setTimeout(function () {
          if (searchManager.spinner != null)
            searchManager.spinner.stop();
          controls.find('.shared-jobstatus-spinner').hide();
        }, 10);
      }
    }
    searchManager.unbind('search:error');
    searchManager.on('search:error', function (properties) {
      console.error("child search error:", properties);
      updateStatus('error', properties);
    });
    searchManager.unbind('search:failed');
    searchManager.on('search:failed', function (properties) {
      console.error("child search failed:", properties);
      updateStatus('failed', properties);
    });
    searchManager.unbind('search:progress');
    searchManager.on('search:progress', function (properties) {
      updateStatus('progress', properties);
    });
    searchManager.unbind('search:done');
    searchManager.on('search:done', function (properties) {
      updateStatus('done', properties);
    });

    var btnGroup = controls.find('.summary .btn-group');
    btnGroup.find('a').unbind();
    btnGroup.find('a.query').click(function (e) {
      e.preventDefault();
      queryDialog(childQuery, 'Chart');
    });
    btnGroup.find('a.export').click(function (e) {
      e.preventDefault();
      exportChartSVG($('#' + chartName + 'stats-chart'), chartName + '.svg');
    });
    btnGroup.find('a.chart-type').click(function (e) {
      e.preventDefault();
      var chartView = splunkjs.mvc.Components.getInstance(chartName + 'stats-chart');
      chartView.settings.set('type', $(this).data('chart-type'));
      var that = this;
      btnGroup.find('a.chart-type').removeClass('active');
      $(this).addClass('active');
    });

    var chartView = splunkjs.mvc.Components.getInstance(chartName + 'stats-chart');
    setupChart(chartView, null, fields, chartHeight);
    var minMax, title;
    if (/timing/.test(chartName)) {
      chartView.settings.set('charting.chart.stackMode', 'stacked');
      if (statGroup == 'total')
        minMax = 1.0; // seconds
      title = 'Relative Timings';
    } else if (/sql/.test(chartName)) {
      chartView.settings.set('charting.chart.stackMode', 'stacked');
      minMax = 16; // statements
      title = 'Statements';
    } else {
      minMax = 100; // actions
      title = 'Actions/s';
    }
    chartView.settings.set('charting.axisTitleY.text', title);

    chartView.unbind();
    chartView.on('rendered', function () {
      var chart;
      // Make sure we only try to load Highcharts once.
      require(['highcharts'], function (Highcharts) {

        for (var i = 0; i < Highcharts.charts.length; i++) {
          if (Highcharts.charts[i] != null && $(this.el).has(Highcharts.charts[i].container).length > 0) {
            chart = Highcharts.charts[i];
            break;
          }
        }
        if (chart == null)
          return;
        //console.log('chart rendered: ' + chart.yAxis[0].axisTitle.text);

        // hack the format of the values for the timing chart
        if (/timing/.test(chartName) && !chart.formatHack) {
          var ttfOrig = chart.tooltip.options.formatter;
          chart.tooltip.options.formatter = function () {
            var rest = ttfOrig.call(this);
            var re = />([0-9.]+)<\/td>/, match, start = 0, out = '';
            while (match = re.exec(rest)) {
              out += match.input.substring(0, match.index) + '>';
              out += formatTiming(match[1]);
              out += '</td>';
              rest = rest.substring(match.index + match[0].length);
            }
            out += rest;
            return out;
          };

          var lfOrig = chart.yAxis[0].labelFormatter;
          chart.yAxis[0].labelFormatter = function () {
            return lfOrig.call(this) + 's';
          };

          chart.formatHack = true;
        }

        // set the Y axis minimum range
        if (minMax != null) {
          chart.yAxis[0].setExtremes(0, Math.max(chart.yAxis[0].dataMax, minMax));
        }

        // force the chart height after rendering
        if (chartHeight > 0) {
          chart.setSize($('body').width(), chartHeight, false);
          $(chartView.$el).css('height', '' + chartHeight + 'px');
          $(chartView.$el).find('div').css('height', '100%');
        }
      });
    });

    controls.find('.summary').show();
    $('#' + chartName + 'stats-chart').show();
    searchManager.startSearch();
  });

  ChartedInfo = selfRowInfo;
  ActiveChart = thisChart;
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

  // hook clicks in the hosts table to focus charts
  var hoststatsTable = splunkjs.mvc.Components.getInstance('hoststats-table');
  hoststatsTable.on('click', function (e) {
    e.preventDefault();
    selectHostsRow($('#hoststats-table tbody tr:nth-child(' + (e.event.rowIndex + 1) + ')'));
    updateCharts(e.data);
  });
  customizeTable(hoststatsTable);

  // using Splunk timerange view
  var timeRange = mvc.Components.getInstance('hoststats-timerange');
  timeRange.on('change', function (e) {
    var tokens = mvc.Components.getInstance("default");
    var value = tokens.get('earliest') + ' - ' + tokens.get('latest');
    if (searchParamChanged != null)
      searchParamChanged('throughput-timerange', value);
    setDefaultParam('throughput-timerange', value);
    startSearch();
  });

  // let Splunk finish initializing
  $('#hoststats-chart').hide();
  setTimeout(function () {
    // change the message in the search results, after a short delay
    $('#hoststats-table .msg .alert-info').empty().append($('<i class="icon-alert"></i>')).append('Search for application hosts using the bar above.');
  }, 10);
});
