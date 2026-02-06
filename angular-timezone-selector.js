/*global angular, _, moment, $, jstz*/

/**
 * angular-timezone-selector
 *
 * A simple directive that allows a user to pick their timezone
 *
 * Author:  Ashok Fernandez <ashok@mish.guru>
 * Date:    12/06/2015
 * License: MIT
 */

angular.module('angular-timezone-selector', [])
  .constant('_', _)
  .constant('moment', moment)
  .factory('timezoneFactory', ['_', 'moment', function (_, moment) {
    return {
      get: function () {
        var timezoneMap = {}
        _.forEach(moment.tz.names(), function (zoneName) {
          var tz = moment.tz(zoneName)
          timezoneMap[zoneName] = {
            id: zoneName,
            name: zoneName.replace(/_/g, ' '),
            offset: 'UTC' + tz.format('Z'),
            nOffset: tz.utcOffset()
          }
        })
        return timezoneMap
      }
    }
  }])

  // Timezone name to country codemap
  .factory('zoneToCC', ['_', function (_) {
    // Note: zones is populated with the data from 'data/zone.csv' when this file is built
    var zones = []
    var zoneMap = {}
    _.forEach(zones, function (zone) {
      zoneMap[zone.name] = zone.cca2
    })
    return zoneMap
  }])

  // Country code to country name map
  .factory('CCToCountryName', ['_', function (_) {
    // Note: codes is populated with the data from 'data/cca2_to_country_name.csv' when this file is built
    var codes = []
    var codeMap = {}
    _.forEach(codes, function (code) {
      codeMap[code.cca2] = code.name
    })
    return codeMap
  }])

  .directive('timezoneSelector', [
    '_', 'moment', 'timezoneFactory', 'zoneToCC', 'CCToCountryName',
    function (_, moment, timezoneFactory, zoneToCC, CCToCountryName) {
      return {
        restrict: 'E',
        require: 'ngModel',
        template: '<select style="min-width:300px;"></select>',
        scope: {
          ngModel: '=',
          translations: '='
        },
        link: function ($scope, elem, attrs, ngModelCtrl) {
          var selectElem = elem.is('select') ? elem : elem.find('select')
          if (!selectElem.length) return

          var data = []
          var timezones = timezoneFactory.get()

          // Group the timezones by their country code
          var grouped = {}
          _.forEach(timezones, function (tz) {
            if (zoneToCC[tz.id]) {
              var cc = zoneToCC[tz.id]
              grouped[cc] = grouped[cc] || []
              grouped[cc].push(tz)
            }
          })

          // Add the grouped countries to the data array with their country name as the group option
          _.forEach(grouped, function (zones, cc) {
            data.push({
              text: CCToCountryName[cc] + ': ',
              children: zones,
              firstNOffset: zones[0].nOffset
            })
          })

          // Sort by UTC or country name
          if (attrs.sortBy === 'offset') {
            data = _.sortBy(data, 'firstNOffset')
            _.forEach(data, function (g) {
              g.children = _.sortBy(g.children, 'nOffset')
            })
          } else {
            data = _.sortBy(data, 'text')
          }

          // add initial options forlocal
          if (attrs.showLocal !== undefined) {
            // Make sure the tz from jstz has underscores replaced with spaces so it matches
            // the format used in timezoneFactory
            var extraTZs
            if (typeof jstz !== 'undefined' && jstz) {
              extraTZs = _.filter(timezones, { id: jstz.determine().name() })
            } else {
              var localUTC = 'UTC' + moment().format('Z')
              extraTZs = _.filter(timezones, { offset: localUTC })
            }

            if (extraTZs && extraTZs.length) {
              data.unshift({
                text: _.get($scope, 'translations.local', 'Local') + ': ',
                children: extraTZs,
                firstNOffset: extraTZs[0].nOffset
              })
            }
          }

          // --- primary choices ---
          if (attrs.primaryChoices) {
            var primaryNames = attrs.primaryChoices.split(' ')
              .map(function (c) { return c.replace('_', ' ') })

            var primaryTZs = _.filter(timezones, function (tz) {
              return _.includes(primaryNames, tz.name)
            })

            if (primaryTZs.length) {
              data.unshift({
                text: _.get($scope, 'translations.primary', 'Primary') + ': ',
                children: primaryTZs,
                firstNOffset: primaryTZs[0].nOffset
              })
            }
          }

          // Construct a select box with the timezones grouped by country
          _.forEach(data, function (group) {
            var optgroup = $('<optgroup label="' + group.text + '">')
            group.children.forEach(function (option) {
              var name = option.name
              if (attrs.displayUtc === 'true' && name.indexOf('(UTC') === -1) {
                name += ' (' + option.offset + ')'
              }
              optgroup.append(
                '<option value="' + option.id + '">' + name + '</option>'
              )
            })
            selectElem.append(optgroup)
          })

          // Initialise the chosen box
          if (typeof selectElem.chosen === 'function') {
            selectElem.chosen({
              width: attrs.width || '300px',
              include_group_label_in_selected: true,
              search_contains: true,
              no_results_text: _.get(
                $scope,
                'translations.no_results_text',
                'No results, try searching for your country or nearest city.'
              ),
              placeholder_text_single: _.get(
                $scope,
                'translations.placeholder',
                'Choose a timezone'
              )
            })
          }

          // --- VIEW → MODEL (ng-change fires here) ---
          selectElem.on('change', function () {
            var value = selectElem.val()
            $scope.$applyAsync(function () {
              ngModelCtrl.$setViewValue(value)
            })
          })

          // --- MODEL → VIEW ---
          ngModelCtrl.$render = function () {
            selectElem.val(ngModelCtrl.$viewValue)
            if (typeof selectElem.chosen === 'function') {
              selectElem.trigger('chosen:updated')
            }
          }

          $scope.$on('$destroy', function () {
            selectElem.off('change')
            if (typeof selectElem.chosen === 'function') {
              try { selectElem.chosen('destroy') } catch (e) {}
            }
          })
        }
      }
    }
  ])
