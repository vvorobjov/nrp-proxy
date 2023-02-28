"""
A Py_Sim Engine for openAI simulation
--> obtain information from simulation and send them to NEST engine
--> receive controller command from NEST engine to run the simulation
"""
from nrp_core.engines.py_sim import PySimEngineScript

class Script(PySimEngineScript):
    def initialize(self):
        # Initialize datapack of sensors with default values
        print("Servo Engine is initializing. Registering device...")
        self._registerDataPack("observation")
        self._setDataPack("observation", { "observation" : [0.0]*2})
        # Initialize datapack of controller with default values
        self._registerDataPack("action")
        self._setDataPack("action", { "action" : 1})

    def runLoop(self, timestep) :
        #  Receive control data and execute
        the_action = self._getDataPack("action").get('action')
        self.endFlag =  self.sim_manager.run_step(the_action, timestep)
        # Collect observation information
        temp_data = self.sim_manager.get_model_property("observation", "Property")
        self._setDataPack("observation", { "observation" : temp_data})

        # 1: To show components one by one
        #print(self.sim_manager.get_model_properties("Property"))
        # 2: To show components' data one by one
        #print(self.sim_manager.get_model_all_properties("Property"))
    def shutdown(self):
        self.sim_manager.shutdown()
        print("Simulation End !!!")
