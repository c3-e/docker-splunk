/*
 * Copyright 2009-2014 C3, Inc. dba C3 Energy (http://www.c3energy.com). All Rights Reserved.
 * This material, including without limitation any software, is the confidential trade secret
 * and proprietary information of C3 Energy and its licensors. Reproduction, use and distribution
 * of this material in any form is strictly prohibited except as set forth in a written
 * license agreement with C3 Energy and/or its authorized distributors.
 */

var ContextFields = [
  {
    field: 'a_id',
    label: 'Action ID',
    groups: ['context'],
    type: 'context'
  },
  {
    field: 'a_pid',
    label: 'Parent Action',
    groups: ['context', 'hidden'],
    type: 'context'
  },
  {
    field: 'a_pids',
    label: 'Parent Actions',
    groups: ['context', 'hidden'],
    type: 'context'
  },
  {
    field: 'a_rid',
    label: 'Root Action',
    groups: ['context'],
    type: 'context'
  },
  {
    field: 'a_func',
    label: 'Function',
    groups: ['context', 'hidden'],
    type: 'context'
  },
  {
    field: 'a_pfuncs',
    label: 'Parent Functions',
    groups: ['context', 'hidden'],
    type: 'context'
  },
  {
    field: 'time',
    label: 'Timestamp',
    groups: ['context'],
    type: 'context'
  },
  {
    field: 'formatted_time',
    label: 'Time',
    groups: ['context'],
    type: 'context'
  },
  {
    field: 't_type',
    label: 'Type',
    groups: ['context'],
    type: 'context'
  },
  {
    field: 't_action',
    label: 'Action',
    groups: ['context'],
    type: 'context'
  },
  {
    field: 'a_st',
    label: 'Status',
    groups: ['context'],
    type: 'context'
  },
  {
    field: 'count',
    label: 'Calls',
    groups: ['context'],
    type: 'count'
  },
];

var TimingFields = [
  {
    field: 'a_t',
    label: 'Total time',
    groups: ['total', 'primary'],
    type: 'timing'
  },
  {
    field: 'a_self',
    label: 'Self time',
    groups: ['self'],
    type: 'timing'
  },
  {
    field: 'a_cpu',
    label: 'Total CPU',
    groups: ['total', 'cpu'],
    type: 'timing'
  },
  {
    field: 'a_self_cpu',
    label: 'Self CPU',
    groups: ['self', 'primary', 'cpu'],
    type: 'timing'
  },
  {
    field: 'a_io',
    label: 'Total I/O',
    groups: ['total', 'io'],
    type: 'timing'
  },
  {
    field: 'a_self_io',
    label: 'Self I/O',
    groups: ['self', 'primary', 'io'],
    type: 'timing'
  },
  {
    field: 'a_sql',
    label: 'Total SQL',
    groups: ['total', 'io', 'io_detail'],
    type: 'timing'
  },
  {
    field: 'a_self_sql',
    label: 'Self SQL',
    groups: ['self', 'io', 'io_detail'],
    type: 'timing'
  },
  {
    field: 'a_kv',
    label: 'Total K/V',
    groups: ['total', 'io', 'io_detail'],
    type: 'timing'
  },
  {
    field: 'a_self_kv',
    label: 'Self K/V',
    groups: ['self', 'io', 'io_detail'],
    type: 'timing'
  },
];

var AllFields = ContextFields.concat(TimingFields);
AllFields.forEach(function (e) {
  e.isGroup = function (name) {
    return this.groups.indexOf(name) >= 0;
  };
  e.isPrimary = function () {
    return this.groups.indexOf('primary') >= 0;
  };
  e.isTiming = function () {
    return this.type == 'timing';
  };
  e.isContext = function () {
    return this.type == 'context';
  };
  e.isCount = function () {
    return this.type == 'count';
  };
});
