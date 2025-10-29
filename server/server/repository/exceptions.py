class EntityExistsError(Exception):
    def __init__(self):
        super().__init__("Entity already exists.")
