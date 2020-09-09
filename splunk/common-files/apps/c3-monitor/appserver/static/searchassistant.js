/*
 * Copyright 2009-2014 C3, Inc. dba C3 Energy (http://www.c3energy.com). All Rights Reserved.
 * This material, including without limitation any software, is the confidential trade secret
 * and proprietary information of C3 Energy and its licensors. Reproduction, use and distribution
 * of this material in any form is strictly prohibited except as set forth in a written
 * license agreement with C3 Energy and/or its authorized distributors.
 */

/*
 * A hostname like "dev-psrb-app-w-002" is broken down as follows:
 *   environment: dev
 *   pod: psrb
 *   cluster: dev-psrb
 *   type: app
 *   role: w
 *   sequence: 002
 * Note that some pods may not have their own DBs, in which case they share the ones in the "c3" pod
 * for the same environment.
 */
var ServerTypes = [
  { key: 'app-m', type: 'app', role: 'm', icon: 'calendar', label: 'C₃ master', inherit: false, order: 11 },
  { key: 'app-w', type: 'app', role: 'w', icon: 'gear', label: 'C₃ worker', inherit: false, order: 12 },
  { key: 'dbora', type: 'db', role: 'ora', icon: 'data-input', label: 'Oracle', inherit: true, order: 21 },
  { key: 'dbmysql', type: 'db', role: 'mysql', icon: 'data-input', label: 'MySQL', inherit: true, order: 22 },
  { key: 'cass', type: 'db', role: 'cass', icon: 'data', label: 'Cassandra', inherit: true, order: 23 },
  { key: 'rs', type: 'db', role: 'rs', icon: 'data', label: 'Redshift', inherit: true, order: 24 },
  { key: 'rails', type: 'web', role: 'rails', icon: 'user', label: 'Rails', inherit: true, order: 31 },
  { key: 'zk', type: 'admin', role: 'zk', icon: 'flag', label: 'ZooKeeper', inherit: true, order: 41 },
];
ServerTypes.forEach(function (e) {
  ServerTypes[e.key] = e;
});
var UnknownType = { type: 'other', role: '', icon: 'question', label: 'other', order: 99 };
var HostProperty = 'host';

function parseHostname(hostname) {
  var remain = hostname, m;
  var environment, pod, sequence, typeInfo;

  if (/^ip-/.test(hostname) || /\.local$/.test(hostname)) {
    typeInfo = UnknownType;
  } else {
    remain = remain.replace(/\..*$/, '');

    if ((m = /^[a-zA-Z0-9_]+-/i.exec(remain))) {
      environment = m[0].substring(0, m[0].length - 1);
      remain = remain.substring(m[0].length);
    }

    if (m = /^[a-zA-Z0-9_]+-/.exec(remain)) {
      pod = m[0].substring(0, m[0].length - 1);
      remain = remain.substring(m[0].length);
    }

    if (m = /-[0-9]+$/.exec(remain)) {
      sequence = m[0].substring(1);
      remain = remain.substring(0, remain.length - m[0].length);
    }

    if (remain === '')
      typeInfo = UnknownType;
    else
      typeInfo = ServerTypes[remain] || UnknownType;
  }

  return {
    hostname: hostname,
    environment: environment,
    pod: pod,
    cluster: environment + '-' + pod,
    type: typeInfo.type,
    role: typeInfo.role,
    typeKey: typeInfo.key,
    sequence: sequence,
    icon: typeInfo.icon,
    label: typeInfo.label,
    order: typeInfo.order
  };
}

function buildClusters(hosts, showTypes, inherit) {
  var clusters = [];
  if (hosts == null || hosts.length < 1)
    return clusters;
  if (showTypes == null)
    showTypes = ServerTypes;

  // group all hosts into clusters (environment/pod)
  var clusterMap = {};
  var clusterNames = [];
  for (var i = 0; i < hosts.length; i++) {
    var host = hosts[i];
    if (host == null || host.environment == null || host.pod == null)
      continue;

    var clusterName = host.cluster;
    var cluster = clusterMap[clusterName];
    if (cluster == null)
      clusterMap[clusterName] = cluster = { name: clusterName, environment: host.environment, hosts: [], events: 0 };
    cluster.hosts.push(host);
    if (host.events != null && host.events > 0)
      cluster.events += host.events;

    if (!/-c3$/.test(clusterName) && clusterNames.indexOf(clusterName) < 0)
      clusterNames.push(clusterName);
  }
  var clusters = [];
  for (i = 0; i < clusterNames.length; i++)
    clusters.push(clusterMap[clusterNames[i]]);

  // build the first-level children of cluster, grouping by role
  for (var i = 0; i < clusters.length; i++) {
    var cluster = clusters[i];
    cluster.searchNames = cluster.name + '-*';

    cluster.roles = [];
    for (var j = 0; j < showTypes.length; j++) {
      var typeInfo = showTypes[j];
      var clusterRoleName = cluster.name + '-' + typeInfo.key;
      var clusterRole = cluster.roles[j] = { info: typeInfo, hosts: [], events: 0, };

      // check for explicit hosts in this pod
      for (var k = 0; k < cluster.hosts.length; k++) {
        var host = cluster.hosts[k];
        if (host.typeKey == typeInfo.key) {
          clusterRole.hosts.push(host);
          if (host.events != null && host.events > 0)
            clusterRole.events += host.events;
        }
      }
      if (clusterRole.hosts.length > 0) {
        clusterRole.name = clusterRoleName;
        if (clusterRole.hosts.length == 1)
          clusterRole.searchNames = clusterRole.hosts[0].hostname;
        else
          clusterRole.searchNames = clusterRoleName + '-*';
      }

      // for types that inherit; check the c3 pod in the same environment
      if (inherit && clusterRole.hosts.length < 1 && typeInfo.inherit) {
        var c3pod = clusterMap[cluster.environment + '-c3'];
        if (c3pod != null) {
          var c3RoleName = c3pod.name + '-' + typeInfo.key;
          for (var k = 0; k < c3pod.hosts.length; k++) {
            var host = c3pod.hosts[k];
            if (host.typeKey == typeInfo.key) {
              cluster.hosts.push(host);
              clusterRole.hosts.push(host);
              if (host.events != null && host.events > 0)
                clusterRole.events += host.events;
            }
          }
          if (clusterRole.hosts.length > 0) {
            clusterRole.name = c3RoleName;
            if (clusterRole.hosts.length == 1)
              clusterRole.searchNames = clusterRole.hosts[0].hostname;
            else
              clusterRole.searchNames = c3RoleName + '-*';
            cluster.searchNames += ',' + clusterRole.searchNames;
          }
        }
      }
    }
  }

  // sort the clusters by event count
  clusters.sort(function (a, b) {
    if (a.events > b.events)
      return -1;
    if (a.events < b.events)
      return 1;
    return a.name.localeCompare(b.name);
  });
  return clusters;
}

function buildHostClusters(hosts) {
  return buildClusters(hosts, null, true);
}

/*
  var TestRows = [
  ["dev-eon-app-w-019","21210498"],
  ["dev-eon-app-w-016","20009265"],
  ["dev-eon-app-w-018","17857716"],
  ["dev-eon-app-w-020","17420388"],
  ["dev-eon-app-w-017","17333980"],
  ["dev-psrb-app-w-031","4277884"],
  ["dev-ci1-app-m-01","3964412"],
  ["dev-psrb-app-w-002","1847699"],
  ["dev-psrb-app-w-005","1807713"],
  ["dev-psrb-app-w-004","1389818"],
  ["dev-psrb-app-w-003","1166075"],
  ["dev-psrb-app-w-001","1059568"],
  ["dev-psrb-app-w-016","619622"],
  ["dev-psrb-app-w-019","606649"],
  ["dev-psrb-app-w-010","589772"],
  ["dev-psrb-app-w-017","554295"],
  ["dev-psrb-app-w-014","542495"],
  ["dev-psrb-app-w-012","528750"],
  ["dev-psrb-app-w-011","502292"],
  ["dev-psrb-app-w-013","489662"],
  ["dev-psrb-app-w-008","484271"],
  ["dev-psrb-app-w-007","466684"],
  ["dev-psrb-app-w-020","451255"],
  ["dev-psrb-app-w-034","443950"],
  ["dev-psrb-app-w-043","435610"],
  ["dev-psrb-app-w-025","427713"],
  ["dev-psrb-app-m-01","423300"],
  ["dev-psrb-app-w-022","421398"],
  ["dev-psrb-app-w-040","407856"],
  ["dev-psrb-app-w-028","402914"],
  ["dev-psrb-app-w-009","397635"],
  ["dev-psrb-app-w-015","373339"],
  ["dev-psrb-app-w-006","362466"],
  ["dev-psrb-app-w-037","359366"],
  ["dev-psrb-app-w-018","354124"],
  ["dev-psrb-app-w-044","333017"],
  ["dev-psrb-app-w-023","296577"],
  ["dev-psrb-app-w-032","286157"],
  ["dev-psrb-app-w-035","285900"],
  ["dev-psrb-app-w-029","257581"],
  ["dev-psrb-app-w-024","248374"],
  ["dev-psrb-app-w-042","226896"],
  ["dev-psrb-app-w-038","225986"],
  ["dev-psrb-app-w-021","218402"],
  ["dev-psrb-app-w-045","196604"],
  ["dev-psrb-app-w-039","176695"],
  ["dev-psrb-app-w-036","162128"],
  ["dev-psrb-app-w-027","137521"],
  ["dev-eon-app-m-01","115623"],
  ["dev-qauto-app-m-01","78223"],
  ["dev-comps-app-m-01","46169"],
  ["dev-srv-app-m-01","39932"],
  ["dev-ui-app-m-01","39748"],
  ["dev-bge-app-m-01","28497"],
  ["dev-psrb-app-w-026","24590"],
  ["dev-enel2-app-m-01","22036"],
  ["dev-ui-app-w-003","20374"],
  ["dev-ui-app-w-001","19919"],
  ["dev-ui-app-w-002","17472"],
  ["dev-psrb-app-w-049","17329"],
  ["dev-psrb-app-w-047","16260"],
  ["dev-comps-app-w-001","16144"],
  ["dev-ci2-app-m-01","15645"],
  ["dev-psrb-app-w-030","15620"],
  ["dev-psrb-app-w-046","15345"],
  ["dev-psrb-app-w-050","14386"],
  ["dev-psrb-app-w-048","12585"],
  ["dev-psrb-app-w-033","11400"],
  ["dev-psrb-app-w-041","11289"],
  ["dev-qauto-app-w-004","9442"],
  ["dev-bge-app-w-013","2863"],
  ["dev-bge-app-w-030","2833"],
  ["dev-podz-app-m-02","1085"],
  ["dev-podz-app-m-03","1077"],
  ["dev-podz-app-m-01","1073"],
  ["dev-podz-app-w-001","1039"],
  ["dev-bge-app-w-021","472"],
  ["dev-bge-app-w-042","431"],
  ["dev-bge-app-w-012","430"],
  ["dev-bge-app-w-081","424"],
  ["dev-bge-app-w-003","409"],
  ["dev-bge-app-w-034","389"],
  ["dev-bge-app-w-085","381"],
  ["dev-bge-app-w-024","365"],
  ["dev-bge-app-w-031","360"],
  ["dev-bge-app-w-033","313"],
  ["dev-bge-app-w-047","293"],
  ["ip-10-0-2-131","1"],
  ["ip-10-0-2-147","1"],
  ["ip-10-0-2-194","1"],
  ["ip-10-0-2-236","1"],
  ["ip-10-0-2-243","1"],
  ["ip-10-0-2-55","1"],
  ["ip-10-0-2-85","1"],
  ["ip-10-0-3-12","1"],
  ["ip-10-0-3-136","1"],
  ["ip-10-0-3-137","1"],
  ["ip-10-0-3-149","1"],
  ["ip-10-0-3-187","1"],
  ["ip-10-0-3-208","1"],
  ["ip-10-0-3-241","1"],
  ["ip-10-0-3-5","1"],
  ["ip-10-0-3-58","1"],
  ["ip-10-0-5-232","1"],
  ["ip-10-0-5-246","1"],
  ["ip-10-0-5-36","1"],
  ["ip-10-0-5-46","1"],
  ["dev-c3-cass-60","35392403"],
  ["dev-c3-cass-10","602259"],
  ["dev-c3-cass-30","503756"],
  ["dev-c3-cass-20","501146"],
  ["dev-psrb-cass-20","444648"],
  ["dev-bge-cass-20","330540"],
  ["dev-psrb-cass-10","317656"],
  ["dev-psrb-cass-30","313821"],
  ["dev-bge-cass-40","302185"],
  ["dev-enel2-cass-20","302077"],
  ["dev-enel2-cass-10","295065"],
  ["dev-enel2-cass-30","294719"],
  ["dev-enel2-cass-40","294717"],
  ["dev-enel2-cass-50","294715"],
  ["dev-psrb-cass-50","283318"],
  ["dev-psrb-cass-60","280991"],
  ["dev-bge-cass-30","258083"],
  ["dev-bge-cass-50","258030"],
  ["dev-bge-cass-60","258020"],
  ["dev-bge-cass-10","257944"],
  ["dev-enel2-cass-60","250802"],
  ["dev-c3-cass-40","246846"],
  ["dev-comed-cass-30","239441"],
  ["dev-c3-cass-50","3515"],
  ["dev-eon-cass-05","2369"],
  ["dev-eon-cass-15","2340"],
  ["dev-eon-cass-45","2339"],
  ["dev-eon-cass-35","2336"],
  ["dev-eon-cass-55","2336"],
  ["dev-eon-cass-25","2334"],
  ["dev-bge-dbora-01","0"],
  ["dev-c3-dbora-01","0"],
  ["dev-poc-dbora-01","0"],
  ["dev-psra-dbora-01","0"],
  ["dev-psrb-dbora-01","0"],
  ["dev-psrc-dbmysql-01","0"],
  ["dev-c3-rails-01","0"],
  ["dev-c3-zk-01", "0"],
  ["dev-c3-rs-01","0"],
  ["jcoker-mac.local","303030"],
  ];
*/

require([
  "splunkjs/ready!",
  "splunkjs/mvc/simplexml/ready!",
  "splunkjs/mvc/tableview",
  "splunkjs/mvc/searchcontrolsview",
], function (mvc) {

  // search assistant handle
  $('#search-header div.search-assistant-wrapper').show();
  $('.search-assistant-container').show();
  $('#search-header div.search-assistant-wrapper a').click(function (e) {
    e.preventDefault();
    var dialog = $('#search-assistant');

    var pos = $('#search-header div.search-assistant-wrapper').offset();
    dialog.css('left', (pos.left + 1) + "px")
      .css('top', (pos.top - 1) + "px")
      .css('margin', '0');
    dialog.modal('show');
  });

  var dialog = $('#search-assistant');

  // create a search controls gadget
  var SearchControlsView = require("splunkjs/mvc/searchcontrolsview");
  new SearchControlsView({
    id: "search-assistant-controls",
    managerid: "host-list",
    el: $("#search-assistant-controls")
  }).render();

  // search assistant host list search
  var table = dialog.find('table.hosts');
  var updateStatus = function (p) {
    var count = dialog.find('.shared-jobstatus-count');
    count.text('');
    // console.log(p)
  };
  var searchManager = splunkjs.mvc.Components.getInstance('host-list');
  if (searchManager == null) {
    console.error("search manager 'host-list' not found");
    return;
  }
  searchManager.on('search:progress', updateStatus);
  searchManager.on('search:done', updateStatus);

  var roleCheck = dialog.find('input[name=roles]');

  var previewData = searchManager.data('preview', {});
  previewData.on('data', function (data) {
    table.find('tbody').remove();
    var rows = data.data().rows;
    var hosts = [];
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var info = parseHostname(row[0]);
      if (info != null) {
        info.events = parseInt(row[1]);
        hosts.push(info);
      }
    }
    var clusters = buildHostClusters(hosts);
    for (var i = 0; i < clusters.length; i++) {
      var cluster = clusters[i];
      var tbody = $('<tbody></tbody>');

      var tr = $('<tr class="cluster" data-search="' + cluster.searchNames + '">'
        + '<td class="name"><a href="#"><i class="icon-distributed-environment"></i> ' + cluster.name + '</a></td>'
        + '<td class="hosts">' + formatCount(cluster.hosts.length) + '</td>'
        + '<td class="events">' + formatCount(cluster.events) + '</td>'
        + '</tr>');
      tbody.append(tr);

      for (var j = 0; j < cluster.roles.length; j++) {
        var role = cluster.roles[j];
        if (role == null || role.hosts.length < 1)
          continue;

        tr = $('<tr class="role" data-search="' + role.searchNames + '">'
          + '<td class="name" title="' + role.info.label + '"><a href="#"><i class="icon-' + role.info.icon + '"></i> ' + role.name + '</a></td>'
          + '<td class="hosts">' + formatCount(role.hosts.length) + '</td>'
          + '<td class="events">' + formatCount(role.events) + '</td>'
          + '</tr>');
        tbody.append(tr);
      }

      table.append(tbody);
    }
    table.find('tbody td a').click(function (e) {
      e.preventDefault();
      applyToSearch(HostProperty, $(this).closest('tr').data('search').split(/ *, */));
      dialog.modal('hide');
    });
    if (!roleCheck.is(':checked'))
      table.find('tbody tr.role').hide();
  });
  searchManager.startSearch();

  roleCheck.change(function (e) {
    if (roleCheck.is(':checked'))
      table.find('tbody tr.role').show();
    else
      table.find('tbody tr.role').hide();
  });
});
