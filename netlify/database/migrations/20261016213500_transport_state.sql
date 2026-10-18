CREATE TABLE transport_state (
 id integer PRIMARY KEY CHECK (id = 1),
 revision integer NOT NULL DEFAULT 0,
 data text NOT NULL
);
