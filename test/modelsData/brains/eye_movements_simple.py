# -*- coding: utf-8 -*-
"""
This brain defines 4 convolutions over the corners of an input layer
All weights are hardcoded and equals
"""
# pragma: no cover
__author__ = 'Jacques Kaiser'

from hbp_nrp_cle.brainsim import simulator as sim

import itertools
import numpy as np
import scipy.spatial.distance as distance
import logging

logger = logging.getLogger(__name__)

class Layer:
    """
    Represents a layer in the network architecture.

    Attributes:

        `population`: The pyNN neuron population of the layer

        `shape`:      The shape of the layer as a tuple of (rows, cols)
    """
    def __init__(self, population, shape):
        self.population = population
        self.shape = shape

    def get_neuron(self, x, y=None):
        idx = self.get_idx(x, y) if y else x
        return self.population[idx]

    def get_idx(self, x, y):
        return x * self.shape[1] + y

    def size(self):
        return self.shape[0] * self.shape[1]

    def get_neuron_box(self, x_range, y_range):
        idx_in_box = []
        for x, y in itertools.product(range(*x_range), range(*y_range)):
            idx_in_box.append(self.get_idx(x, y))
        return self.population[idx_in_box]


def add_lateral_connections_topology(layer, distance_to_weight):
    proj = sim.Projection(layer.population, layer.population,
                          sim.AllToAllConnector(),
                          sim.StaticSynapse())

    weights = np.zeros((layer.size(), layer.size()))

    # for all combinations of neurons
    for x1, y1, x2, y2 in itertools.product(
            np.arange(layer.shape[0]), np.arange(layer.shape[1]),
            repeat=2):
        w = distance_to_weight(distance.cityblock([x1, y1], [x2, y2]))
        weights[layer.get_idx(x1, y1)][layer.get_idx(x2, y2)] = w

    proj.set(weight=weights)

scaling_factor = 0.1
DVS_SHAPE = np.array((128, 128))
# scale down DVS input to speed up the network
input_shape = (DVS_SHAPE * scaling_factor + 1).astype(int)  # + 1 for ceiling

# the two neuron populations: sensors and motors
sensors = sim.Population(size=np.prod(input_shape),
                         cellclass=sim.IF_curr_exp())
motors = sim.Population(size=4, cellclass=sim.IF_curr_exp())

output_layer = Layer(motors, (2, 2))
input_layer = Layer(sensors, input_shape)

n_rows = input_shape[0]
low_range = (0, n_rows/2)
high_range = (n_rows/2, n_rows)

inhibition_weight = -10
excitatory_weight = 0.5

# slice pixel neurons in 4 corners
top_left_bucket = input_layer.get_neuron_box(low_range, low_range)
top_right_bucket = input_layer.get_neuron_box(high_range, low_range)
bottom_left_bucket = input_layer.get_neuron_box(low_range, high_range)
bottom_right_bucket = input_layer.get_neuron_box(high_range, high_range)

# connect each bucket to respective output neuron
for idx, bucket in enumerate([top_left_bucket, top_right_bucket,
                              bottom_left_bucket, bottom_right_bucket]):
    sim.Projection(bucket,
                   sim.PopulationView(motors, [idx]),
                   sim.AllToAllConnector(),
                   sim.StaticSynapse(weight=excitatory_weight))


inhibition_weight = -10
# lateral inhibition in the output layer
add_lateral_connections_topology(output_layer, lambda d: inhibition_weight if d != 0 else 0)

print('There are {}x{}={} neurons in the input layer'
      .format(input_shape[0],
              input_shape[1],
              np.prod(input_shape)
          ))

print('There are {} motor neurons'
      .format(len(motors)))

circuit = sensors + motors
