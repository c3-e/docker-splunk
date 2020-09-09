/*
 * Copyright 2009-2014 C3, Inc. dba C3 Energy (http://www.c3energy.com). All Rights Reserved.
 * This material, including without limitation any software, is the confidential trade secret
 * and proprietary information of C3 Energy and its licensors. Reproduction, use and distribution
 * of this material in any form is strictly prohibited except as set forth in a written
 * license agreement with C3 Energy and/or its authorized distributors.
 */

var ChartColors = [
  '6CB8CA', 'FAC61D', 'D85E3D', '956E96', 'F7912C', '9AC23C', '998C55', 'DD87B0', '5479AF',
  'E0A93B', '6B8930', 'A04558', 'A7D4DF', 'FCDD77', 'E89E8B', 'BFA8C0', 'FABD80', 'C2DA8A',
  'C2BA99', 'EBB7D0', '98AFCF', 'ECCB89', 'A6B883', 'C68F9B', '416E79', '967711', '823825',
  '59425A', '94571A', '5C7424', '5C5433', '85516A', '324969', '866523', '40521D', '602935'
];

function setupChart(chartView, title, fields, height) {

  // X axis title
  if (title == null || title === '') {
    chartView.settings.set('charting.axisTitleX.visibility', 'collapsed');
  } else {
    chartView.settings.set('charting.axisTitleX.visibility', 'visible');
    chartView.settings.set('charting.axisTitleX.text', title);
  }

  // series colors
  var colors = [];
  if (fields == null || fields.length < 1) {
    // use standard colors
    colors = ChartColors;
  } else {
    // use colors on the fields, if specified
    var remain = [].concat(ChartColors);
    for (var i = 0; i < fields.length; i++) {
      var chosen;
      if (fields[i].color != null)
        chosen = fields[i].color;
      else
        chosen = remain[0];
      colors.push(chosen);

      var index = remain.indexOf(chosen);
      if (index >= 0)
        remain.splice(index, 1);
    }
  }
  var formatted = '[';
  for (var i = 0; i < colors.length; i++) {
    if (i > 0)
      formatted += ',';
    formatted += '0x' + colors[i];
  }
  formatted += ']';
  chartView.settings.set('charting.seriesColors', formatted);

  // set the chart height
  if (height != null && height > 0) {
    chartView.settings.set('height', height);
    var heightPx = '' + height + 'px';
    $(chartView.$el).css('height', heightPx);
  }
}

