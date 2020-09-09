/*
 * Copyright 2009-2014 C3, Inc. dba C3 Energy (http://www.c3energy.com). All Rights Reserved.
 * This material, including without limitation any software, is the confidential trade secret
 * and proprietary information of C3 Energy and its licensors. Reproduction, use and distribution
 * of this material in any form is strictly prohibited except as set forth in a written
 * license agreement with C3 Energy and/or its authorized distributors.
 */

function buildQuery(inputSearch, groupBy, dataFields, span, rate) {
  if (inputSearch == null)
    inputSearch = '';
  else
    inputSearch = $.trim(inputSearch);

  if (groupBy === '' || groupBy === '-')
    groupBy = null;

  if (span == null || span === '')
    span = '5s';
  var spanLen = spanLengthSeconds(span);

  var props = {
    typeSearch: 'index="jmx" mbean_property_type="ActionStats"',
    inputSearch: inputSearch,
    groupBy: groupBy,
    dataFields: dataFields,
    span: span,
  };

  // start with the custom search
  var finalSearch = props.typeSearch;
  if (inputSearch != null && inputSearch !== '')
    finalSearch += ' ' + inputSearch;
  props.finalSearch = finalSearch;

  // build up the |timechart or |stats clauses
  var showFields, columns = [], groupFields = [], contextFields = [], countFields = [], filters = '';
  if (!groupBy) {
    if (rate) {
      for (var i = 0; i < dataFields.length; i++) {
        if (dataFields[i].isStats() && dataFields[i].agg == 'sum')
          filters += ' | eval ' + dataFields[i].field + '_rate=' + dataFields[i].field + '/' + spanLen + '/5';
      }
    }

    filters += ' | timechart span=' + span + ' ';
    for (var i = 0; i < dataFields.length; i++) {
      if (i > 0)
        filters += ', ';

      var fieldUsed = dataFields[i].field;
      if (rate && dataFields[i].agg == 'sum')
        fieldUsed += '_rate';
      var expr = dataFields[i].agg + '(' + fieldUsed + ') AS "' + dataFields[i].label + '"';
      filters += expr;

      columns.push({
        field: dataFields[i],
        expr: expr,
        usage: 'data',
        agg: dataFields[i].agg,
        label: dataFields[i].label
      });
    }
  } else {
    // get all the fields we want to use
    groupFields = getFieldsByNames($.trim(groupBy).split(/[ ,]+/));

    if (groupBy == 'host')
      contextFields = getFieldsByNames('cluster', 'role');
    else
      contextFields = getFieldsByNames('host');

    var potentialDataFields = dataFields;
    dataFields = [];
    for (var i = 0; i < potentialDataFields.length; i++) {
      if (potentialDataFields[i] != null &&
        groupFields.indexOf(potentialDataFields[i]) < 0 &&
        contextFields.indexOf(potentialDataFields[i]) < 0 &&
        dataFields.indexOf(potentialDataFields[i]) < 0)
        dataFields.push(potentialDataFields[i]);
    }

    countFields = getFieldsByNames('count');
    showFields = [].concat(groupFields);
    showFields = showFields.concat(contextFields);
    showFields = showFields.concat(countFields);
    showFields = showFields.concat(dataFields);

    // generate custom fields we might need
    if (getFieldIndexByName(showFields, 'cluster') >= 0) {
      filters += ' | eval cluster=if(match(host,"^[a-z][a-z0-9]+-[a-z][a-z0-9]+-.*-0*[1-9][0-9]*$"),replace(host,"^([a-z][a-z0-9]+-[a-z][a-z0-9]+)-.*$", "\\1"),host)';
    }
    if (getFieldIndexByName(showFields, 'role') >= 0) {
      filters += ' | eval role=if(match(host,"-app-m-"),"master",if(match(host,"-app-w-"),"worker",""))';
    }

    // group fields always show up first
    columns = [];
    for (var i = 0; i < groupFields.length; i++) {
      columns.push({
        field: groupFields[i],
        expr: groupFields[i].field,
        usage: 'group',
        label: groupFields[i].label
      })
    }

    // build up the |stats clauses
    filters += ' | stats ';
    var ncontext = 0;
    for (var i = 0; i < contextFields.length; i++) {
      if (groupFields.indexOf(contextFields[i]) < 0) {
        if (ncontext > 0)
          filters += ', ';

        var agg, label;
        if (contextFields[i].field == 'host') {
          agg = 'dc';
          label = 'Hosts';
        } else {
          agg = 'values';
          label = contextFields[i].label;
        }
        var expr = agg + '(' + contextFields[i].field + ')';
        filters += expr;
        ncontext++;

        columns.push({
          field: contextFields[i],
          expr: expr,
          usage: 'data',
          agg: agg,
          label: label
        });
      }
    }
    for (var i = 0; i < countFields.length; i++) {
      if (ncontext > 0)
        filters += ', ';

      var expr = countFields[i].field;
      filters += expr;
      ncontext++;

      columns.push({
        field: countFields[i],
        expr: expr,
        usage: 'data',
        label: countFields[i].label
      });
    }
    var statFields = [];
    var otherFields = [];
    for (var i = 0; i < dataFields.length; i++) {
      if (dataFields[i].type == 'context') {
        if (ncontext > 0)
          filters += ', ';

        // context field, emit in first pass
        var expr = 'values(' + dataFields[i].field + ')';
        filters += ', ' + expr;
        ncontext++;

        columns.push({
          field: dataFields[i],
          expr: expr,
          usage: 'data',
          label: dataFields[i].label
        });
      } else if (dataFields[i].isStats()) {
        // stat field, emit together by aggregations
        statFields.push(dataFields[i]);
      } else {
        // other fields, emit at end
        otherFields.push(dataFields[i]);
      }
    }
    for (var i = 0; i < statFields.length; i++) {
      if (ncontext > 0 || i > 0)
        filters += ', ';

      var expr = statFields[i].agg + '(' + statFields[i].field + ')';
      filters += expr;

      columns.push({
        field: statFields[i],
        expr: expr,
        usage: 'data',
        agg: statFields[i].agg,
        label: statFields[i].label
      });
    }
    for (var i = 0; i < otherFields.length; i++) {
      var expr = 'values(' + otherFields[i].field + ')';
      filters += ', ' + expr;

      columns.push({
        field: otherFields[i],
        expr: expr,
        usage: 'data',
        label: otherFields[i].label
      });
    }
    filters += ' by ' + groupBy;

    // build sort clause
    filters += ' | sort -' + 'sum(a_count), -' + 'sum(a_active), -count';

    // build rename clause
    filters += ' | rename ';
    for (var i = 0; i < columns.length; i++) {
      if (i > 0)
        filters += ', ';
      filters += columns[i].expr + ' AS "' + columns[i].label + '"'
    }
  }
  for (var i = 0; i < columns.length; i++)
    columns[i].index = i;

  // complete the property object to return
  props.groupFields = groupFields;
  props.contextFields = contextFields;
  props.countFields = countFields;
  props.showFields = showFields;
  props.columns = columns;
  props.filters = filters;
  props.query = finalSearch + filters;
  props.created = new Date();
  queryAccessors(props);

  //console.log(JSON.stringify(props));
  return props;
}
