# Complete Examples

## Table of Contents
- [Level 1-2: Simple (ItdString, ItdEmail)](#level-1-2)
- [Level 3: Non-standard (ItdBoolean Core + Front)](#itdboolean)
- [Level 5: Composite (ItdTimeFrame Core + Front)](#itdtimeframe)

## Level 1-2

### Level 1: ItdString (methods only)

```jsx
/* global GenericInput */
export default {
  name: "ItdString",
  extends: GenericInput,
  methods: {
    formatter(v) { return v?.trim() ?? v; },
    keypress(e) { /* filter keystrokes if needed */ }
  }
};
```

### Level 2: ItdEmail (type + validator)

```jsx
/* global GenericInput */
const {$validator} = Vue;
$validator.addValidator("email", "email", function () {
  const val = this[this.$options.$validateSelfValue];
  if (val && !emailRegex.test(val)) {
    return `"{{input.label}}" no es un correo válido`;
  }
  return "";
});

export default {
  name: "ItdEmail",
  extends: GenericInput,
  data() { return { type: "email" }; },
  methods: {
    formatter(v) { return v ? v.trim().toLowerCase() : v; },
    renderView() {
      const val = this[this.$options.$validateSelfValue];
      const [LinkTag] = this.resolveTags("linkTag");
      return val ? <LinkTag href={`mailto:${val}`}>{val}</LinkTag> : <span>-</span>;
    },
    renderDetail() { return this.renderView(); }
  }
};
```

No front needed for Level 1-2 — GI's default rendering (BFormInput via defaultTagMap) handles everything.

---

## ItdBoolean

Core handles native checkbox, front overrides with toggle-button + BV icons.

### Core (`libs/.../components/ItdBoolean.jsx`)

```jsx
/* global GenericInput */

function cast(v) {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    switch (v.toLowerCase()) {
      case "true": return true;
      case "false": return false;
      default: return null;
    }
  }
  return null;
}

export {cast};

export default {
  name: "ItdBoolean",
  extends: GenericInput,
  data() {
    return {
      lazy: true,            // checkbox emits 'change', not 'input'
      type: "checkbox",
      valueProp: "checked",  // DOM: el.checked = value
      targetValue: "checked" // extract: event.target.checked
    };
  },
  methods: {
    cast,
    emitter: v => (typeof v === "boolean" ? v : null),
    initVal: v => (typeof v === "boolean" ? v : null),
    renderView() {
      const val = this[this.$options.$validateSelfValue];
      return <span>{val ? "\u2713" : "\u2717"}</span>;
    },
    renderDetail() { return this.renderView(); }
  }
};
```

### Front (`fronts/.../components/ItdBoolean.jsx`)

```jsx
import CoreBoolean from "core/components/ItdBoolean.jsx";
import {BIconCheck2Square, BIconSquare} from "bootstrap-vue";

export default {
  name: "ItdBoolean",
  extends: CoreBoolean,
  $BVP: "FormRadioPlugin",
  components: {
    ToggleButton: () => import("vue-js-toggle-button").then(comp => comp.ToggleButton),
    BIconCheck2Square, BIconSquare
  },
  data() {
    return {
      valueProp: undefined,   // reset: BV uses "value"
      targetValue: "value"    // reset: toggle emits value, not Event
    };
  },
  methods: {
    renderView() {
      const val = this[this.$options.$validateSelfValue];
      return <b-icon icon={val ? "check2-square" : "square"} font-scale="1.5" />;
    },
    renderInput() {
      const ToggleButton = this.$options.components.ToggleButton;
      return (
        <ToggleButton
          value={this[this.$options.$validateSelfValue]}
          {...{props: this.toggleConfig, on: {input: this.updateValue}}}
        />
      );
    }
  }
};
```

---

## ItdTimeFrame

Composite input (Form-as-Input) — Object value rendered as sub-form with inner validation.

### Core (`libs/.../components/ItdTimeFrame.jsx`)

```jsx
/* global GenericInput, cloneDeep, isNil */
import {mapGetters} from "vuex";

const {$validator} = Vue;
$validator.addValidator("timeframe", "timeframe", async function () {
  const errors = [];
  const formErrors = await this.$refs.input?.validateSelf();
  if (formErrors?.length) {
    const formDef = this.form;
    errors.push(
      ...formErrors.flatMap(e => {
        const label = formDef.find(f => f.name === e.name)?.label || e.name;
        return e.errors.map(err => err.replace(/\{\{input\.label\}\}/g, label));
      })
    );
  }
  const val = this[this.$options.$validateSelfValue];
  if (val?.measure && val?.duration) {
    const measureConfig = this.input?.measures?.find(m => m.value === val.measure);
    if (measureConfig && val.duration > measureConfig.duration) {
      const maxHuman = new Intl.DurationFormat(this.getLocale, {style: "long"}).format({
        [val.measure]: measureConfig.duration
      });
      errors.push(`duración fuera de rango (máximo ${maxHuman})`);
    }
  }
  return errors.join(", ");
});

export default {
  name: "ItdTimeFrame",
  extends: GenericInput,
  $lodash: ["cloneDeep", "isNil"],
  data() {
    return {
      tag: "ItdForm",          // resolved via localTag → resolveComp
      lazy: false,             // ItdForm emits "input", not "change"
      measureOptions: /* ... */,
      measureInputExtra: {},   // extension point for front
      durationInputExtra: {}   // extension point for front
    };
  },
  computed: {
    ...mapGetters("Config", ["getLocale"]),
    form() {
      return [
        { name: "measure", type: "String", component: "ItdSelect",
          validate: {required: true}, ...this.measureInputExtra },
        { name: "duration", type: "Number", component: "ItdSelect",
          validate: {required: true}, ...this.durationInputExtra }
      ];
    }
  },
  methods: {
    emitter: v => v,
    initVal(v) {
      return typeof v === "object" && !isNil(v) ? cloneDeep(v) : {duration: null, measure: null};
    },
    getInputProps() {
      return { ...this.defaultGetInputProps(), cols: "1", form: this.form, config: {} };
    },
    renderView() { return <span>{this.humanize}</span>; },
    renderDetail() { return this.renderView(); }
  }
};
```

### Front (`fronts/.../components/ItdTimeFrame.jsx`)

```jsx
import CoreTimeFrame from "core/components/ItdTimeFrame.jsx";

export default {
  name: "ItdTimeFrame",
  extends: CoreTimeFrame,
  data() {
    return {
      measureInputExtra: {tag: "b-select"},
      durationInputExtra: {tag: "b-select"}
    };
  }
  // NOTE: No renderInput override needed — GF core auto-wraps
  // mode="input" with is-valid/is-invalid validation border.
};
```

### Key Patterns

1. `tag: "ItdForm"` + `lazy: false` — GI renders ItdForm, listens on `input`
2. `getInputProps()` with `...this.defaultGetInputProps()` — NEVER without spread
3. `this.$refs.input` from renderMainInput — validator calls inner form's validateSelf
4. Extra objects `{}` spread in computed — front overrides with `{tag: "b-select"}`
5. `this.defaultRenderInput()` in front — NEVER `CoreX.methods.renderInput.call(this)`
6. Mustache resolution — replace `{{input.label}}` with labels from form definition
