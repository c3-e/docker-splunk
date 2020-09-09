/*
 * Copyright 2009-2014 C3, Inc. dba C3 Energy (http://www.c3energy.com). All Rights Reserved.
 * This material, including without limitation any software, is the confidential trade secret
 * and proprietary information of C3 Energy and its licensors. Reproduction, use and distribution
 * of this material in any form is strictly prohibited except as set forth in a written
 * license agreement with C3 Energy and/or its authorized distributors.
 */

var ExportBlob = null;

function exportTableCSV(table, rowClass, filename) {
  if (!filename)
    filename = 'export.csv';

  var contents = '';
  table.find('thead tr').each(function () {
    $(this).find('th').each(function (i) {
      if (i > 0)
        contents += ',';
      contents += '"' + $.trim($(this).text()) + '"';
    });
    contents += '\n';
  });
  var rows = 0;
  var rowSel = 'tr';
  if (rowClass)
    rowSel += '.' + rowClass;
  rowSel += ':visible';
  table.find('tbody ' + rowSel).each(function () {
    $(this).find('td').each(function (i) {
      var quote = false;

      if (i == 0) {
        var indent = $(this).find('.indent').length;
        if (indent > 0) {
          quote = true;
          contents += '"';
          for (var j = 1; j < indent; j++)
            contents += "\u00A0\u00A0";
          contents += "\u21B3";
        }
      } else {
        contents += ',';
      }

      var text = $.trim($(this).text());
      if (!quote && /[,\"]/.test(text)) {
        quote = true;
        contents += '"';
      }
      contents += text.replace(/"/g, '""');
      if (quote)
        contents += '"';
    });
    contents += '\n';
    rows++;
  });
  if (rows < 1)
    return;

  if (ExportBlob != null)
    window.URL.revokeObjectURL(ExportBlob);
  ExportBlob = window.URL.createObjectURL(new Blob(["\ufeff", contents], { type: 'text/csv;charset=UTF-8' }));
  $('<a>', {
    href: ExportBlob,
    download: filename,
    charset: "UTF-8"
  }).get(0).click();
}

function exportChartSVG(chart, filename) {
  var svg = chart.find('svg');
  if (svg.length != 1)
    return;
  var contents = svg.clone().wrap('<p>').parent().html();

  if (ExportBlob != null)
    window.URL.revokeObjectURL(ExportBlob);
  ExportBlob = window.URL.createObjectURL(new Blob(["\ufeff", contents], { type: 'image/svg+xml;charset=UTF-8' }));
  $('<a>', {
    href: ExportBlob,
    download: filename,
    charset: "UTF-8"
  }).get(0).click();
}
