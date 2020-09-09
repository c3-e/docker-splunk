/*
 * Copyright 2009-2014 C3, Inc. dba C3 Energy (http://www.c3energy.com). All Rights Reserved.
 * This material, including without limitation any software, is the confidential trade secret
 * and proprietary information of C3 Energy and its licensors. Reproduction, use and distribution
 * of this material in any form is strictly prohibited except as set forth in a written
 * license agreement with C3 Energy and/or its authorized distributors.
 */

function formatToolTip(col) {
  var toolTip = col.field.label;
  if (col.agg)
    toolTip = col.agg + ' ' + toolTip;
  if (col.expr)
    toolTip += ': ' + col.expr;
  return toolTip;
}

function customizeTable(tableView) {

  // adjust HTML table (rendered by Splunk view)
  tableView.table.bind('rendered', function () {
    var table = this.$el.find('table');
    var rows = 0;
    if (table.is(':visible')) {
      table.find('thead th').each(function (index) {
        var column = QueryProps.columns[index];
        if (!column) return;

        if (!column.field.isTiming() && !column.field.isCount())
          $(this).removeClass('numeric');

        $(this).attr('title', formatToolTip(column));

        if (column.field.isGroup('hidden')) {
          $(this).hide();
          table.find('tbody tr td:nth-child(' + (index + 1) + ')').hide();
        }
      });

      rows = table.find('tbody tr').size();
    }
    var viewId = this.$el.data('cid');

    var pageSize = null;
    var findPageSize = function () {
      pageSize = null;
      $('div.page-size').each(function () {
        if ($(this).data('view-id') == viewId)
          pageSize = $(this).find('.btn-group');
      });
    };
    findPageSize();
    if (rows >= 12) {
      if (pageSize == null) {
        this.$el.after('<div class="page-size pull-left" data-view-id="' + viewId + '"><span>Page size:&nbsp;</span><div class="btn-group"></div></div>');
        findPageSize();

        pageSize.append('<a class="btn btn-small dropdown-toggle" data-toggle="dropdown" id="dropdownPageSize" href="#"><span>12</span><i class="caret"></i></a>');
        pageSize.append('<ul class="dropdown-menu" role="menu" aria-labelledby="dropdownPageSize"></ul>');
        var ul = pageSize.find('ul.dropdown-menu');
        [12, 25, 50, 100].forEach(function (v, i) {
          ul.append('<li role="presentation"><a role="menuitem" tabindex="-1" data-value="' + v + '" href="#">' + v + '</a></li>');
        });
        pageSize.find('.dropdown-toggle').dropdown();
      } else {
        pageSize.find('a[role=menuitem]').unbind();
        pageSize.parent().show();
      }
      pageSize.find('.dropdown-toggle span').text(tableView.settings.get('pageSize'));
      pageSize.find('a[role=menuitem]').click(function (e) {
        var count = parseInt($(this).text());
        tableView.settings.set('pageSize', count);
        pageSize.find('.dropdown-toggle span').text(count);
      });
    } else if (pageSize != null) {
      pageSize.find('.dropdown-toggle').dropdown();
      pageSize.hide();
    }
  });

  // add a custom cell renderer to table view
  var TableView = require("splunkjs/mvc/tableview");
  var CellRenderer = TableView.BaseCellRenderer.extend({
    canRender: function (cellData) {
      return true;
    },
    render: function (td, cellData) {
      var column = QueryProps.columns[cellData.index];
      if (!column) return;
      if (column.field.isCount()) {
        td.addClass('numeric');
        td.text(formatCount(cellData.value));
        td.attr('data-value', cellData.value);
      } else if (column.field.isTiming()) {
        td.addClass('numeric');
        td.text(formatTiming(cellData.value));
        td.attr('data-value', cellData.value);
      } else {
        td.removeClass('numeric');
        if (column.usage == 'group')
          td.addClass('grouped');
        td.text(formatValues(cellData.value));
        if (cellData.value instanceof Array)
          td.attr('data-value', cellData.value.join(','));
        else
          td.attr('data-value', cellData.value);
      }
    }
  });
  tableView.table.addCellRenderer(new CellRenderer());
}

require([
  "splunkjs/ready!",
  "splunkjs/mvc/simplexml/ready!",
], function (mvc) {

  // add our copyright message at the bottom
  setTimeout(function () {
    var currentYear = new Date().getFullYear();
    var extra = $('<br/><span>&copy; 2009-' + currentYear + ' <a href="http://www.c3iot.com ">C3, Inc. dba C3 IoT</a>. All Rights Reserved.</span>');
    var tryAgain = function () {
      var pc = $('#footer [data-role="copyright"]');
      // footer tag instead of element with footer id could exist
      pc = pc.length === 0 ? $('footer [data-role="copyright"]') : pc;
      if (pc.length > 0) {
        pc.append(extra);
      } else {
        setTimeout(tryAgain, 100);
      }
    }
    tryAgain();
  }, 10);

  // set up the application bar tabs
  setTimeout(function () {
    var viewIcons = {
      overview: 'distributed-environment',
      throughput: 'gear',
      profiler: 'clock',
    };
    var lastPathComponent = function (path) {
      path = path.replace(/[?#].*$/, '');
      path = path.replace(/\/$/, '');
      path = path.replace(/[^\/]*\//g, '');
      return path;
    }

    /*
     * When app bar is loaded, make a couple of changes:
     *
     * 1. Remove the default app icon
     * 2. Add icons to each tab
     *
     * The app icon we were using contained an old C3 logo. If we want to show an updated logo at some point,
     * remove the references to appIcon below and create the appropriate icon files. See
     *
     *    https://dev.splunk.com/enterprise/docs/developapps/createapps/configureappproperties/
     */
    var tryAgain = function () {
      var appIcon = $('[data-role="app-icon"] img');
      var items = $('[data-view="views/shared/appbar/AppNav"] a');
      var currentView = lastPathComponent(window.location.pathname);
      if (appIcon.length > 0 && items.length > 0) {
        appIcon.hide();
        items.each(function (i) {
          var viewName = lastPathComponent($(this).attr('href'));
          if (viewName) {
            $(this).addClass('nav-item-' + viewName);
            $(this).attr('data-viewname', viewName);

            var icon = viewIcons[viewName];
            if (icon)
              $(this).prepend('<i class="icon-' + icon + '"></i> ');

            if (viewName == currentView)
              $(this).addClass('active');
          }
        });
      } else {
        setTimeout(tryAgain, 100);
      }
    };
    tryAgain();
  }, 10);
});
