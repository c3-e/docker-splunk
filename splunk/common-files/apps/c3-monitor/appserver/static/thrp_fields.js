/*
 * Copyright 2009-2014 C3, Inc. dba C3 Energy (http://www.c3energy.com). All Rights Reserved.
 * This material, including without limitation any software, is the confidential trade secret
 * and proprietary information of C3 Energy and its licensors. Reproduction, use and distribution
 * of this material in any form is strictly prohibited except as set forth in a written
 * license agreement with C3 Energy and/or its authorized distributors.
 */

var ContextFields = [
  {
    field: 'cluster',
    label: 'Cluster',
    groups: ['context'],
    type: 'context'
  },
  {
    field: 'role',
    label: 'Role',
    groups: ['context'],
    type: 'context'
  },
  {
    field: 'host',
    label: 'Host',
    groups: ['context'],
    type: 'context'
  },
  {
    field: 'count',
    label: 'Ticks',
    groups: ['context'],
    type: 'context'
  },
];

var StatsFields = [
  {
    field: 'a_count',
    label: 'Total Actions',
    color: '6CB8CA',
    groups: ['actions', 'primary'],
    type: 'stats'
  },
  {
    field: 'a_completedcount',
    label: 'Complete Actions',
    color: '9AC23C',
    groups: ['actions', 'primary'],
    type: 'stats'
  },
  {
    field: 'a_failedcount',
    label: 'Failed Actions',
    color: 'D85E3D',
    groups: ['actions', 'primary'],
    type: 'stats'
  },
  {
    field: 'a_active',
    label: 'Active Actions',
    color: 'FAC61D',
    groups: ['actions'],
    type: 'stats'
  },
  {
    field: 'a_totaltime',
    label: 'T. Action Time',
    groups: ['actions', 'total'],
    type: 'stats'
  },
  {
    field: 'a_avgtime',
    label: 'μ Action Time',
    groups: ['actions', 'mean'],
    type: 'stats'
  },
  {
    field: 'a_mediantime',
    label: 'M Action Time',
    groups: ['actions', 'median'],
    type: 'stats'
  },
  {
    field: 'a_p95time',
    label: 'p₉₅ Action Time',
    groups: ['actions', 'p95'],
    type: 'stats'
  },
  {
    field: 'cpu_totaltime',
    label: 'T. CPU Time',
    groups: ['cpu', 'total'],
    type: 'stats'
  },
  {
    field: 'cpu_avgtime',
    label: 'μ CPU Time',
    groups: ['cpu', 'mean'],
    type: 'stats'
  },
  {
    field: 'cpu_mediantime',
    label: 'M CPU Time',
    groups: ['cpu', 'median'],
    type: 'stats'
  },
  {
    field: 'cpu_p95time',
    label: 'p₉₅ CPU Time',
    groups: ['cpu', 'p95'],
    type: 'stats'
  },
  {
    field: 'sql_count',
    label: 'Total SQL',
    groups: ['sql'],
    type: 'stats'
  },
  {
    field: 'sql_active',
    label: 'Active SQL',
    groups: ['sql'],
    type: 'stats'
  },
  {
    field: 'sql_completedcount',
    label: 'Complete SQL',
    groups: ['sql'],
    type: 'stats'
  },
  {
    field: 'sql_failedcount',
    label: 'Failed SQL',
    groups: ['sql'],
    type: 'stats'
  },
  {
    field: 'sql_totaltime',
    label: 'T. SQL Time',
    groups: ['sql', 'total'],
    type: 'stats'
  },
  {
    field: 'sql_avgtime',
    label: 'μ SQL Time',
    groups: ['sql', 'mean'],
    type: 'stats'
  },
  {
    field: 'sql_mediantime',
    label: 'M SQL Time',
    groups: ['sql', 'median'],
    type: 'stats'
  },
  {
    field: 'sql_p95time',
    label: 'p₉₅ SQL Time',
    groups: ['sql', 'p95'],
    type: 'stats'
  },
  {
    field: 'sql_clusterQueued',
    label: 'Queued SQL',
    groups: ['sql', 'cluster'],
    color: 'FAC61D',
    type: 'stats'
  },
  {
    field: 'sql_clusterActive',
    label: 'Active SQL',
    groups: ['sql', 'cluster'],
    color: '6CB8CA',
    type: 'stats'
  },
  {
    field: 'kv_count',
    label: 'Total K/V',
    groups: ['kv'],
    type: 'stats'
  },
  {
    field: 'kv_active',
    label: 'Active K/V',
    groups: ['kv'],
    type: 'stats'
  },
  {
    field: 'kv_completedcount',
    label: 'Complete K/V',
    groups: ['kv'],
    type: 'stats'
  },
  {
    field: 'kv_failedcount',
    label: 'Failed K/V',
    groups: ['kv'],
    type: 'stats'
  },
  {
    field: 'kv_totaltime',
    label: 'T. K/V Time',
    groups: ['kv', 'total'],
    type: 'stats'
  },
  {
    field: 'kv_avgtime',
    label: 'μ K/V Time',
    groups: ['kv', 'mean'],
    type: 'stats'
  },
  {
    field: 'kv_mediantime',
    label: 'M K/V Time',
    groups: ['kv', 'median'],
    type: 'stats'
  },
  {
    field: 'kv_p95time',
    label: 'p₉₅ K/V Time',
    groups: ['kv', 'p95'],
    type: 'stats'
  },
];

var AllFields = ContextFields.concat(StatsFields);
AllFields.forEach(function (e) {
  e.isGroup = function (name) {
    return this.groups.indexOf(name) >= 0;
  };
  e.isPrimary = function () {
    return this.groups.indexOf('primary') >= 0;
  };
  e.isTiming = function () {
    return /time$/.test(this.field);
  };
  e.isContext = function () {
    return this.type == 'context';
  };
  e.isCount = function () {
    return /(active|count)$/.test(this.field);
  };
  e.isStats = function () {
    return this.type == 'stats';
  };

  // determine the chart color
  if (/time$/.test(e.field)) {
    if (/^cpu_/.test(e.field))
      e.color = '9AC23C';
    else if (/^sql_/.test(e.field))
      e.color = '6CB8CA';
    else if (/^kv_/.test(e.field))
      e.color = '956E96';
    else
      e.color = '000000';
  }

  // determine the natural aggregation function
  if (/p95time$/.test(e.field))
    e.agg = 'max';
  else if (/totaltime$/.test(e.field) || /active$/.test(e.field))
    e.agg = 'sum';
  else if (/time$/.test(e.field) || /active$/.test(e.field))
    e.agg = 'avg';
  else if (/^sql_cluster/.test(e.field) || /active$/.test(e.field))
    e.agg = 'avg';
  else
    e.agg = 'sum';
});
