/*
 * Copyright 2009-2014 C3, Inc. dba C3 Energy (http://www.c3energy.com). All Rights Reserved.
 * This material, including without limitation any software, is the confidential trade secret
 * and proprietary information of C3 Energy and its licensors. Reproduction, use and distribution
 * of this material in any form is strictly prohibited except as set forth in a written
 * license agreement with C3 Energy and/or its authorized distributors.
 */

function buildQuery(inputSearch, groupBy, dataFields, agg) {
  if (inputSearch == null)
    inputSearch = '';
  else
    inputSearch = $.trim(inputSearch);

  if (groupBy === '' || groupBy === '-')
    groupBy = null;

  if (dataFields == null)
    dataFields = [];

  if (!agg)
    agg = ["sum"];
  else if (typeof agg === "string")
    agg = $.trim(agg).split(/[,\s]+/);

  var props = {
    typeSearch: 'logger="c3.action" a_t',
    inputSearch: inputSearch,
    groupBy: groupBy,
    dataFields: dataFields,
    agg: agg,
  };

  // start with the custom search
  var finalSearch = props.typeSearch;
  if (inputSearch != null && inputSearch !== '')
    finalSearch = finalSearch ? [finalSearch, inputSearch].join(' AND ') : inputSearch;
  props.finalSearch = finalSearch;

  // build up the |table or |stats clauses
  var filters = '', showFields, columns = [], groupFields = [], contextFields = [], countFields = [];
  if (!groupBy) {
    // get all the fields we want to use
    contextFields = getFieldsByNames('formatted_time', 'a_id', 'a_pids', 't_type', 't_action', 'a_st');
    potentialDataFields = dataFields;
    dataFields = [];
    for (var i = 0; i < potentialDataFields.length; i++) {
      if (potentialDataFields[i] != null &&
        contextFields.indexOf(potentialDataFields[i]) < 0 &&
        dataFields.indexOf(potentialDataFields[i]) < 0)
        dataFields.push(potentialDataFields[i]);
    }
    showFields = contextFields.concat(dataFields);

    // use plain table clause
    filters += ' | eval formatted_time=strftime(_time, "%F %R") | sort by a_t desc, a_self desc | table ';
    for (var i = 0; i < showFields.length; i++) {
      if (i > 0)
        filters += ', ';
      filters += showFields[i].field;
      columns[i] = {
        field: showFields[i],
        expr: showFields[i].field,
        usage: 'data'
      };
    }
    filters += ' | rename ';
    for (var i = 0; i < showFields.length; i++) {
      filters += ', ' + showFields[i].field + ' AS "' + showFields[i].label + '"';
      columns[i].label = showFields[i].label;
    }
  } else {
    // get all the fields we want to use
    groupFields = getFieldsByNames($.trim(groupBy).split(/[ ,]+/));

    var potentialContextFields = getFieldsByNames('t_type', 't_action', 'a_func', 'a_pfuncs', 'a_st');
    contextFields = [];
    for (var i = 0; i < potentialContextFields.length; i++) {
      if (groupFields.indexOf(potentialContextFields[i]) < 0)
        contextFields.push(potentialContextFields[i]);
    }

    potentialDataFields = dataFields;
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

    // group fields always show up first
    for (var i = 0; i < groupFields.length; i++) {
      columns.push({
        field: groupFields[i],
        expr: groupFields[i].field,
        usage: 'group',
        label: groupFields[i].label
      })
    }

    // build stats clause
    filters += ' | stats ';
    var ncontext = 0;
    for (var i = 0; i < contextFields.length; i++) {
      if (groupFields.indexOf(contextFields[i]) < 0) {
        if (ncontext > 0)
          filters += ', ';

        var expr = 'values(' + contextFields[i].field + ')';
        filters += expr;
        ncontext++;

        columns.push({
          field: contextFields[i],
          expr: expr,
          usage: 'data',
          agg: 'values',
          label: contextFields[i].label
        });
      }
    }
    for (var i = 0; i < countFields.length; i++) {
      if (ncontext > 0)
        filters += ', ';

      filters += countFields[i].field;
      ncontext++;

      columns.push({
        field: countFields[i],
        expr: countFields[i].field,
        usage: 'data',
        label: countFields[i].label
      });
    }
    var timingFields = [];
    var otherFields = [];
    for (var i = 0; i < dataFields.length; i++) {
      if (dataFields[i].type == 'context') {
        // context field, emit in first pass
        var expr = 'values(' + dataFields[i].field + ')';
        filters += ', ' + expr;

        columns.push({
          field: dataFields[i],
          expr: expr,
          usage: 'data',
          label: dataFields[i].label
        });
      } else if (dataFields[i].type == 'timing') {
        // timing field, emit together by aggregations
        timingFields.push(dataFields[i]);
      } else {
        // other fields, emit at end
        otherFields.push(dataFields[i]);
      }
    }
    for (var j = 0; j < agg.length; j++) {
      for (var i = 0; i < timingFields.length; i++) {
        if (j + 1 < agg.length && !timingFields[i].isPrimary())
          continue;

        var expr = agg[j] + '(' + timingFields[i].field + ')';
        filters += ', ' + expr;

        var label = getAggAbbrev(agg[j]) + ' ';
        if (/^(Total|Self)\b/.test(timingFields[i].label)) {
          label += timingFields[i].label.substring(0, 1) + '.' +
            timingFields[i].label.replace(/^(Total|Self) */, ' ');
        }
        columns.push({
          field: timingFields[i],
          expr: expr,
          usage: 'data',
          agg: agg[j],
          label: label
        });
      }
    }
    for (var i = 0; i < otherFields.length; i++) {
      // other field, emit in first pass
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
    filters += ' | sort -' + agg[0] + '(a_t), -' + agg[0] + '(a_self), -count';

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
