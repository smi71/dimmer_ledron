const {} = require('zigbee-herdsman-converters/lib/modernExtend');
// Add the lines below
const fz = require('zigbee-herdsman-converters/converters/fromZigbee');
const tz = require('zigbee-herdsman-converters/converters/toZigbee');
const exposes = require('zigbee-herdsman-converters/lib/exposes');
const reporting = require('zigbee-herdsman-converters/lib/reporting');
const extend = require('zigbee-herdsman-converters/lib/extend');
const ota = require('zigbee-herdsman-converters/lib/ota');
const tuya = require('zigbee-herdsman-converters/lib/tuya');
const {} = require('zigbee-herdsman-converters/lib/tuya');
const utils = require('zigbee-herdsman-converters/lib/utils');
const globalStore = require('zigbee-herdsman-converters/lib/store');
const e = exposes.presets;
const ea = exposes.access;

const DataType = {
  uint8: 0x20,
  uint16: 0x21,
};

const fzLocal = {
  ts110e_brightness: {
    cluster: "genLevelCtrl",
    type: ["attributeReport", "readResponse"],
    convert: (model, msg, publish, options, meta) => {
      if (msg.data.hasOwnProperty("61440")) {
        let minBrightness = meta.state.hasOwnProperty("brightness_min")
          ? meta.state.brightness_min
          : 0;
        let maxBrightness = meta.state.hasOwnProperty("brightness_max")
          ? meta.state.brightness_max
          : 1000;
        let level = utils.mapNumberRange(
          msg.data["61440"],
          minBrightness,
          maxBrightness,
          0,
          255
        );
        meta.logger.debug(`TS110E: FZ-Brightness level changed to: ${level}`);
        return { brightness: level };
      }
    },
  },
  brightness_min: {
    cluster: "genLevelCtrl",
    type: ["attributeReport", "readResponse"],
    convert: (model, msg, publish, options, meta) => {
      if (msg.data.hasOwnProperty("64515")) {
        return { brightness_min: msg.data["64515"] };
      }
    },
  },
  brightness_max: {
    cluster: "genLevelCtrl",
    type: ["attributeReport", "readResponse"],
    convert: (model, msg, publish, options, meta) => {
      if (msg.data.hasOwnProperty("64516")) {
        return { brightness_max: msg.data["64516"] };
      }
    },
  },
  led_type: {
    cluster: "genLevelCtrl",
    type: ["attributeReport", "readResponse"],
    convert: (model, msg, publish, options, meta) => {
      const lookup1 = { 0: "led", 1: "incandescent", 2: "halogen" };
      if (msg.data.hasOwnProperty("64514")) {
        const property = utils.postfixWithEndpointName("led_type", msg, model);
        return { [property]: lookup1[msg.data["64514"]] };
      }
    },
  },
};

const tzLocal = {
  light_onoff_brightness: {
    key: ["brightness"],
    options: [exposes.options.transition()],
    convertSet: async (entity, key, value, meta) => {
      const minBrightness = meta.state.hasOwnProperty("brightness_min")
        ? meta.state.brightness_min
        : 0;

      const maxBrightness = meta.state.hasOwnProperty("brightness_max")
        ? meta.state.brightness_max
        : 1000;

      const level = utils.mapNumberRange(
        value,
        0,
        255,
        minBrightness,
        maxBrightness
      );
      meta.logger.debug(`TS110E: TZ-Brightness level changed to: ${level}`);
      const switchState = value > 0 ? "ON" : "OFF";
      // await tz.on_off.convertSet(entity, "state", switchState, meta);
      await entity.command(
        "genOnOff",
        1,
        {},
        utils.getOptions(meta.mapped, entity)
      );
      await utils.sleep(1); // To-Think: why is this needed?
      await entity.command(
        "genLevelCtrl",
        "moveToLevelTuya",
        { level, transtime: 0 },
        utils.getOptions(meta.mapped, entity)
      );
    },
    convertGet: async (entity, key, meta) => {
      if (key === "brightness") {
        await entity.read("genLevelCtrl", [61440]);
      } else if (key === "state") {
        await tz.on_off.convertGet(entity, key, meta);
      }
    },
  },
  ts110e_brightness_min: {
    key: ["brightness_min"],
    convertSet: async (entity, key, value, meta) => {
      let payload = { 64515: { value: value, type: DataType.uint16 } };
      await entity.write(
        "genLevelCtrl",
        payload,
        utils.getOptions(meta.mapped, entity)
      );
    },
    convertGet: async (entity, key, meta) => {
      await entity.read("genLevelCtrl", [64515]);
    },
  },
  ts110e_brightness_max: {
    key: ["brightness_max"],
    convertSet: async (entity, key, value, meta) => {
      let payload = { 64516: { value: value, type: DataType.uint16 } };
      await entity.write(
        "genLevelCtrl",
        payload,
        utils.getOptions(meta.mapped, entity)
      );
    },
    convertGet: async (entity, key, meta) => {
      await entity.read("genLevelCtrl", [64516]);
    },
  },
  ts110e_led_type: {
    key: ["led_type"],
    convertSet: async (entity, key, value, meta) => {
      value = value.toLowerCase();
      const lookup1 = { led: 0, incandescent: 1, halogen: 2 };
      newValue = parseInt(lookup1[value]);
      payload = { 64514: { value: newValue, type: DataType.uint8 } };
      await entity.write(
        "genLevelCtrl",
        payload,
        utils.getOptions(meta.mapped, entity)
      );
    },
    convertGet: async (entity, key, meta) => {
      await entity.read("genLevelCtrl", [64514]);
    },
  },
};

const definition = {
    zigbeeModel: ['TS110E'],
    model: 'TS110E', // Update this with the real model of the device (written on the device itself or product page)
//    vendor: '_TZ3210_guijtl8k', // Update this with the real vendor of the device (written on the device itself or product page)
    vendor: 'LEDRON', // Update this with the real vendor of the device (written on the device itself or product page)
    description: 'Dimmer 0-10v', // Description of the device, copy from vendor site. (only used for documentation and startup logging)
    extend: [],
  fromZigbee: [
    fz.on_off,
    fz.power_on_behavior,
    fzLocal.ts110e_brightness,
    fzLocal.brightness_min,
    fzLocal.brightness_max,
    fzLocal.led_type,
  ],
  toZigbee: [
    tz.on_off,
    tz.power_on_behavior,
    tzLocal.light_onoff_brightness,
    tzLocal.ts110e_brightness_min,
    tzLocal.ts110e_brightness_max,
    tzLocal.ts110e_led_type,
  ],
  exposes: [
    e.light_brightness(),
    exposes.numeric("brightness_min", ea.ALL),
    exposes.numeric("brightness_max", ea.ALL),
/*    exposes
      .enum("led_type", ea.ALL, ["led", "incandescent", "halogen"])
      .withDescription("Controls the type led"),
    exposes
      .enum("power_on_behavior", ea.ALL, ["off", "previous", "on"])
      .withDescription("Controls the behaviour when the device is powered on"), */
  ],
  configure: async (device, coordinatorEndpoint, logger) => {
    const endpoint = device.getEndpoint(1);
    await extend
      .light_onoff_brightness()
      .configure(device, coordinatorEndpoint, logger);
    await reporting.bind(endpoint, coordinatorEndpoint, [
      "genOnOff",
      "genLevelCtrl",
    ]);
    await reporting.onOff(endpoint);
  },
  icon: 'data:image/png;base64,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',
};

module.exports = definition;