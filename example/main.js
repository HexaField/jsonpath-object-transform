import transform from "../dist/index";

const path = {
  foo: [
    "$.some.crazy",
    {
      bar: "$.example",
    },
  ],
};

const data = {
  some: {
    crazy: [{ example: "A" }, { example: "B" }],
  },
};

const result = transform(data, path);

const el = document.getElementById("app");
el.textContent = JSON.stringify(result, null, 2);
