define([
  'lodash'
],
function (_) {
  'use strict';

  function MetricFindQuery(datasource, query, timeSrv) {
    this.datasource = datasource;
    this.query = query;
    this.range = timeSrv.timeRange();
  }

  MetricFindQuery.prototype.process = function() {
    var label_values_regex = /^label_values\((?:(.+),\s*)?([a-zA-Z_][a-zA-Z0-9_]+)\)$/;
    var metric_names_regex = /^metrics\((.+)\)$/;
    var query_result_regex = /^query_result\((.+)\)$/;

    var label_values_query = this.query.match(label_values_regex);
    if (label_values_query) {
      if (label_values_query[1]) {
        return this.labelValuesQuery(label_values_query[2], label_values_query[1]);
      } else {
        return this.labelValuesQuery(label_values_query[2], null);
      }
    }

    var metric_names_query = this.query.match(metric_names_regex);
    if (metric_names_query) {
      return this.metricNameQuery(metric_names_query[1]);
    }

    var query_result_query = this.query.match(query_result_regex);
    if (query_result_query) {
      return this.queryResultQuery(query_result_query[1]);
    }

    // if query contains full metric name, return metric name and label list
    return this.metricNameAndLabelsQuery(this.query);
  };

  MetricFindQuery.prototype.labelValuesQuery = function(label, metric) {
    var url;

    if (!metric) {
      // return label values globally
      url = '/api/v1/label/' + label + '/values';

      return this.datasource._request('GET', url).then(function(result) {
        return _.map(result.data.data, function(value) {
          return {text: value};
        });
      });
    } else {
      var start = this.datasource.getTime(this.range.from, false);
      var end = this.datasource.getTime(this.range.to, true);
      url = '/api/v1/series?match[]=' + encodeURIComponent(metric)
        + '&start=' + start
        + '&end=' + end;

      return this.datasource._request('GET', url)
      .then(function(result) {
        return _.map(result.data.data, function(metric) {
          return {
            text: metric[label],
            expandable: true
          };
        });
      });
    }
  };

  MetricFindQuery.prototype.metricNameQuery = function(metricFilterPattern) {
    var url = '/api/v1/metrics/results';
    var data = {};
    return this.datasource._request('POST', url, data)
    .then(function(result) {
      return _.chain(result.data.data)
      .filter(function(metricName) {
        var r = new RegExp(metricFilterPattern);
        return r.test(metricName);
      })
      .map(function(matchedMetricName) {
        return {
          text: matchedMetricName,
          expandable: true
        };
      })
      .value();
    });
  };

  MetricFindQuery.prototype.queryResultQuery = function(query) {
    var end = this.datasource.getTime(this.range.to, true);
    var url = '/api/v1/query?query=' + encodeURIComponent(query) + '&time=' + end;

    return this.datasource._request('GET', url)
    .then(function(result) {
      return _.map(result.data.data.result, function(metricData) {
        var text = metricData.metric.__name__ || '';
        delete metricData.metric.__name__;
        text += '{' +
                _.map(metricData.metric, function(v, k) { return k + '="' + v + '"'; }).join(',') +
                '}';
        text += ' ' + metricData.value[1] + ' ' + metricData.value[0] * 1000;

        return {
          text: text,
          expandable: true
        };
      });
    });
  };

  MetricFindQuery.prototype.metricNameAndLabelsQuery = function(query) {
    var start = this.datasource.getTime(this.range.from, false);
    var end = this.datasource.getTime(this.range.to, true);
    var url = '/api/v1/series?match[]=' + encodeURIComponent(query)
      + '&start=' + start
      + '&end=' + end;

    var self = this;
    return this.datasource._request('GET', url)
    .then(function(result) {
      return _.map(result.data.data, function(metric) {
        return {
          text: self.datasource.getOriginalMetricName(metric),
          expandable: true
        };
      });
    });
  };

  return MetricFindQuery;
});
